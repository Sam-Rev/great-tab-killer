"""Local dashboard: http://127.0.0.1:<port>, reachable only from this machine."""

import json
import os
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from .bench import (Bench, Store, VARIANTS, SUMMARY_METRICS, load_default_urls)
from .metrics import summarize, diff

DASHBOARD_FILE = os.path.join(os.path.dirname(__file__), "dashboard.html")


class Manual:
    """Manual A/B against any running browser (e.g. your everyday Chrome):
    record A, do something by hand, record B."""

    def __init__(self, sampler, store):
        self.sampler = sampler
        self.store = store
        self.reset()

    def reset(self):
        self.state = {"inst": None, "label": "", "A": None, "B": None,
                      "running": None, "phase_ends": None, "settle_ends": None}

    def start(self, phase, inst, window, settle, label):
        if self.state["running"]:
            raise ValueError("Замер уже идёт")
        if phase == "B" and not self.state["A"]:
            raise ValueError("Сначала запишите A")
        if phase == "A":
            self.reset()
            self.state["inst"] = str(inst)
        self.state["label"] = label or self.state["label"]
        self.state["running"] = phase
        threading.Thread(target=self._run, args=(phase, window, settle), daemon=True).start()

    def _run(self, phase, window, settle):
        st = self.state
        if settle:
            st["settle_ends"] = time.time() + settle
            time.sleep(settle)
        st["settle_ends"] = None
        t0 = time.time()
        st["phase_ends"] = t0 + window
        time.sleep(window)
        st[phase] = summarize(self.sampler.samples_between(t0, time.time()), st["inst"])
        st["running"] = None
        st["phase_ends"] = None
        if phase == "B":
            self.store.data["manual"].insert(0, {
                "id": uuid.uuid4().hex[:10], "time": time.time(),
                "label": st["label"] or "без названия",
                "A": st["A"], "B": st["B"], "delta": diff(st["A"], st["B"]),
            })
            self.store.save()


def make_server(sampler, repo, port):
    store = Store()
    manual = Manual(sampler, store)
    marks = []
    bench_holder = {"bench": None}

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def _json(self, obj, code=200):
            body = json.dumps(obj, ensure_ascii=False).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _body(self):
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n) or b"{}")

        def do_GET(self):
            u = urlparse(self.path)
            q = parse_qs(u.query)
            if u.path == "/":
                with open(DASHBOARD_FILE, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
            elif u.path == "/api/state":
                since = float(q.get("since", ["0"])[0])
                inst = q.get("inst", [None])[0]
                samples = sampler.samples_since(since)
                latest = samples[-1] if samples else None
                with sampler.lock:
                    procs = sampler.latest_procs.get(int(inst), []) if inst and inst.isdigit() else []
                    instances = []
                    if sampler.samples:
                        for k, v in sampler.samples[-1]["inst"].items():
                            instances.append({"key": k, "app": v["app"], "label": v["label"], "fp": v["fp"]})
                b = bench_holder["bench"]
                self._json({
                    "now": time.time(),
                    "samples": samples,
                    "instances": instances,
                    "procs": procs[:25],
                    "marks": marks,
                    "manual": manual.state,
                    "bench": b.status if b else None,
                    "bench_pid": b.status.get("browser_pid") if b else None,
                    "results_version": store.version,
                    "interval": sampler.interval,
                })
            elif u.path == "/api/results":
                self._json(store.data)
            elif u.path == "/api/meta":
                self._json({
                    "variants": VARIANTS,
                    "metrics": SUMMARY_METRICS,
                    "urls": load_default_urls(),
                })
            else:
                self._json({"error": "not found"}, 404)

        def do_POST(self):
            u = urlparse(self.path)
            try:
                body = self._body()
                if u.path == "/api/mark":
                    marks.append({"t": time.time(), "label": body.get("label") or "метка"})
                    self._json({"ok": True})
                elif u.path == "/api/manual":
                    manual.start(body["phase"], body.get("inst"), int(body.get("window") or 30),
                                 int(body.get("settle") or 0), body.get("label"))
                    marks.append({"t": time.time(), "label": "ручной замер " + body["phase"]})
                    self._json({"ok": True})
                elif u.path == "/api/manual/reset":
                    manual.reset()
                    self._json({"ok": True})
                elif u.path == "/api/bench/start":
                    b = bench_holder["bench"]
                    if b and b.status["running"]:
                        raise ValueError("Автотест уже идёт")
                    b = Bench(sampler, store, repo, body)
                    bench_holder["bench"] = b
                    threading.Thread(target=b.run, daemon=True).start()
                    self._json({"ok": True})
                elif u.path == "/api/bench/stop":
                    b = bench_holder["bench"]
                    if b:
                        b.stop_event.set()
                    self._json({"ok": True})
                elif u.path == "/api/results/delete":
                    store.delete(body["kind"], body["id"])
                    self._json({"ok": True})
                else:
                    self._json({"error": "not found"}, 404)
            except Exception as e:
                self._json({"error": str(e)}, 400)

    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.daemon_threads = True
    return server
