"""
Automatic A/B bench.

Every run starts a fresh, separate Chrome (own temporary profile, the user's
Chrome is untouched), loads this extension from the repo, opens the same set
of URLs, then:

  load wait -> measure A -> apply variant -> settle -> measure B -> close

Only the processes of that Chrome instance are measured. Variants are rotated
between repeats so slow drift of the machine does not favour one of them, and
the "control" variant (do nothing) measures that drift so it can be
subtracted.
"""

import json
import os
import tempfile
import threading
import time
import uuid

from . import cdp
from .metrics import summarize, diff

VARIANTS = [
    ("control", "Контроль: ничего не делать (дрейф)"),
    ("tgs", "TGS: усыпить вкладки"),
    ("tgs_discard", "TGS: усыпить + discard заглушек"),
    ("discard", "Нативный discard Chrome"),
    ("freeze", "Заморозка (как Sleeping Tabs в Edge)"),
    ("close", "Закрыть вкладки (предел экономии)"),
]
VARIANT_NAMES = dict(VARIANTS)

# metrics shown in summaries, in display order: (key, label, unit, lower_is_better)
SUMMARY_METRICS = [
    ("fp", "Chrome: вся память", "МБ"),
    ("fp_renderer", "  вкладки (renderer)", "МБ"),
    ("fp_extension", "  процессы расширений", "МБ"),
    ("fp_gpu", "  GPU", "МБ"),
    ("fp_browser", "  browser-процесс", "МБ"),
    ("fp_utility", "  служебные (сеть, аудио…)", "МБ"),
    ("nprocs", "Chrome: процессов", "шт"),
    ("cpu_pct", "Chrome: CPU", "%"),
    ("wakeups_ps", "Chrome: пробуждения CPU", "/с"),
    ("energy_idx", "Chrome: энергия (индекс)", ""),
    ("sys_swap_used", "Система: swap занят", "МБ"),
    ("sys_compressor", "Система: сжатая память", "МБ"),
    ("sys_free_pct", "Система: свободно памяти", "%"),
    ("sys_swapins_ps", "Система: чтение из swap", "стр/с"),
    ("sys_decompressions_ps", "Система: распаковки", "стр/с"),
]

DATA_DIR = os.path.expanduser("~/.tgs-memlab")
RESULTS_FILE = os.path.join(DATA_DIR, "results.json")
DEFAULT_URLS_FILE = os.path.join(os.path.dirname(__file__), "bench_urls.txt")


class Aborted(Exception):
    pass


# ------------------------------------------------------------------
# result storage
# ------------------------------------------------------------------

class Store:
    def __init__(self, path=RESULTS_FILE):
        self.path = path
        self.lock = threading.Lock()
        self.version = 0
        try:
            with open(path) as f:
                self.data = json.load(f)
        except (OSError, ValueError):
            self.data = {}
        self.data.setdefault("sessions", [])
        self.data.setdefault("manual", [])

    def save(self):
        with self.lock:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            tmp = self.path + ".tmp"
            with open(tmp, "w") as f:
                json.dump(self.data, f, ensure_ascii=False, indent=1)
            os.replace(tmp, self.path)
            self.version += 1

    def delete(self, kind, item_id):
        with self.lock:
            self.data[kind] = [x for x in self.data.get(kind, []) if x.get("id") != item_id]
        self.save()


def load_default_urls():
    with open(DEFAULT_URLS_FILE) as f:
        return [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]


def _median(vals):
    vals = sorted(v for v in vals if v is not None)
    if not vals:
        return None
    n = len(vals)
    return vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2


def summarize_session(session):
    """Per variant: median of A, B and B-A over repeats, plus net effect
    (variant's delta minus the control's delta)."""
    by_variant = {}
    for run in session.get("runs", []):
        if run.get("error") or not run.get("delta"):
            continue
        by_variant.setdefault(run["variant"], []).append(run)
    out = {}
    for variant, runs in by_variant.items():
        row = {"n": len(runs), "A": {}, "B": {}, "delta": {}}
        for key, _, _ in SUMMARY_METRICS:
            row["A"][key] = _median([r["A"].get(key) for r in runs])
            row["B"][key] = _median([r["B"].get(key) for r in runs])
            row["delta"][key] = _median([r["delta"].get(key) for r in runs])
        out[variant] = row
    control = out.get("control")
    for variant, row in out.items():
        row["net"] = {}
        for key, _, _ in SUMMARY_METRICS:
            d = row["delta"].get(key)
            c = control["delta"].get(key) if control else None
            row["net"][key] = (d - c) if (d is not None and c is not None) else None
    return out


# ------------------------------------------------------------------
# bench runner
# ------------------------------------------------------------------

class Bench:
    def __init__(self, sampler, store, repo, config, log=print):
        self.sampler = sampler
        self.store = store
        self.repo = os.path.abspath(repo)
        self.cfg = {
            "variants": config.get("variants") or ["control", "tgs", "discard"],
            "repeats": int(config.get("repeats") or 2),
            "urls": config.get("urls") or load_default_urls(),
            "load_wait": int(config.get("load_wait") or 60),
            "settle": int(config.get("settle") or 60),
            "window": int(config.get("window") or 45),
            "chrome": config.get("chrome") or None,
            "label": config.get("label") or "",
        }
        unknown = [v for v in self.cfg["variants"] if v not in VARIANT_NAMES]
        if unknown:
            raise ValueError("Неизвестные варианты: " + ", ".join(unknown))
        self._log = log
        self.stop_event = threading.Event()
        self.status = {"running": False, "phase": "", "phase_ends": None,
                       "run_index": 0, "run_total": 0, "log": [], "session_id": None,
                       "browser_pid": None}

    # -------------------------------------------------------------
    def log(self, msg):
        line = time.strftime("%H:%M:%S ") + msg
        self.status["log"].append(line)
        self.status["log"] = self.status["log"][-300:]
        self._log(line)

    def _sleep(self, seconds, phase):
        self.status["phase"] = phase
        self.status["phase_ends"] = time.time() + seconds
        if self.stop_event.wait(seconds):
            raise Aborted()

    def _check_stop(self):
        if self.stop_event.is_set():
            raise Aborted()

    def per_run_seconds(self):
        c = self.cfg
        return c["load_wait"] + c["window"] * 2 + c["settle"] + 25

    # -------------------------------------------------------------
    def run(self):
        c = self.cfg
        session = {
            "id": uuid.uuid4().hex[:10],
            "started": time.time(),
            "finished": None,
            "label": c["label"],
            "config": {k: v for k, v in c.items()},
            "runs": [],
        }
        self.store.data["sessions"].insert(0, session)
        self.store.save()
        self.status.update(running=True, session_id=session["id"],
                           run_total=c["repeats"] * len(c["variants"]), run_index=0)
        chrome_path = cdp.find_chrome(c["chrome"])
        self.log("Chrome: %s" % chrome_path)
        self.log("Вариантов: %d × повторов: %d, ~%d мин" % (
            len(c["variants"]), c["repeats"],
            round(self.status["run_total"] * self.per_run_seconds() / 60)))
        try:
            for rep in range(c["repeats"]):
                # rotate the order every round so machine drift is spread evenly
                k = rep % len(c["variants"])
                order = c["variants"][k:] + c["variants"][:k]
                for variant in order:
                    self.status["run_index"] += 1
                    run = self.run_one(chrome_path, variant, rep)
                    session["runs"].append(run)
                    session["summary"] = summarize_session(session)
                    self.store.save()
        except Aborted:
            self.log("Остановлено пользователем")
            session["aborted"] = True
        finally:
            session["finished"] = time.time()
            session["summary"] = summarize_session(session)
            self.store.save()
            self.status.update(running=False, phase="", phase_ends=None, browser_pid=None)
            self.log("Готово")
        return session

    # -------------------------------------------------------------
    def run_one(self, chrome_path, variant, rep):
        c = self.cfg
        self.log("── %s (повтор %d) ──" % (VARIANT_NAMES[variant], rep + 1))
        run = {"variant": variant, "rep": rep, "started": time.time()}
        os.makedirs(os.path.join(DATA_DIR, "profiles"), exist_ok=True)
        profile = tempfile.mkdtemp(prefix="run-", dir=os.path.join(DATA_DIR, "profiles"))
        browser = cdp.Browser(chrome_path, profile)
        self.status["browser_pid"] = browser.pid
        try:
            browser.wait_ready()
            ext_id = browser.load_unpacked(self.repo)
            self._sleep(3, "запуск расширения")
            ctl = self._open_control_page(browser, ext_id)
            self._reset_tabs(browser, ctl, ext_id)

            self.status["phase"] = "открываю вкладки"
            for url in c["urls"]:
                self._check_stop()
                browser.open_tab(url, background=True)
                time.sleep(0.3)
            self.log("Открыто вкладок: %d, жду загрузку %d с" % (len(c["urls"]), c["load_wait"]))
            self._sleep(c["load_wait"], "загрузка страниц")

            run["state_before"] = self._tab_state(browser, ctl, ext_id)
            run["A"] = self._measure(browser.pid, "замер A (до)")
            run["apply"] = self._apply(browser, ctl, ext_id, variant)
            self.log("Применено: %s" % json.dumps(run["apply"], ensure_ascii=False))
            self._sleep(c["settle"], "стабилизация после действия")
            run["state_after"] = self._tab_state(browser, ctl, ext_id)
            run["B"] = self._measure(browser.pid, "замер B (после)")
            run["delta"] = diff(run["A"], run["B"])
            self.log("Память Chrome: %.0f → %.0f МБ (%+.0f), CPU %.1f%% → %.1f%%" % (
                run["A"]["fp"] or 0, run["B"]["fp"] or 0, run["delta"].get("fp") or 0,
                run["A"]["cpu_pct"] or 0, run["B"]["cpu_pct"] or 0))
        except Aborted:
            raise
        except Exception as e:
            run["error"] = str(e)
            self.log("ОШИБКА: %s" % e)
        finally:
            self.status["phase"] = "закрываю Chrome"
            browser.close(remove_profile=True)
            self.status["browser_pid"] = None
            time.sleep(3)
        return run

    def _measure(self, pid, phase):
        t0 = time.time()
        self._sleep(self.cfg["window"], phase)
        return summarize(self.sampler.samples_between(t0, time.time()), pid)

    # -------------------------------------------------------------
    def _open_control_page(self, browser, ext_id):
        """An extension page in a background tab, used to call chrome.* APIs."""
        tid = browser.open_tab("chrome-extension://%s/html/restoring-window.html" % ext_id)
        sid = browser.attach(tid)
        for _ in range(40):
            try:
                if browser.evaluate(sid, "typeof chrome.tabs") == "object":
                    return {"target": tid, "session": sid}
            except cdp.CDPError:
                pass
            time.sleep(0.5)
        raise cdp.CDPError("страница расширения не загрузилась (расширение не запустилось?)")

    def _reset_tabs(self, browser, ctl, ext_id):
        # first install opens options.html as the active tab: close it, make
        # the initial about:blank tab active so all test tabs stay background
        browser.evaluate(ctl["session"], """(async () => {
          const tabs = await chrome.tabs.query({});
          for (const t of tabs) {
            if (t.url.includes('/html/options.html')) await chrome.tabs.remove(t.id);
          }
          const blank = (await chrome.tabs.query({})).find(t => t.url === 'about:blank');
          if (blank) await chrome.tabs.update(blank.id, {active: true});
        })()""")

    def _content_tabs_js(self, ext_id):
        return ("(await chrome.tabs.query({})).filter(t => /^https?:/.test(t.url) || "
                "t.url.startsWith('chrome-extension://%s/html/suspended.html'))" % ext_id)

    def _tab_state(self, browser, ctl, ext_id):
        return browser.evaluate(ctl["session"], """(async () => {
          const tabs = %s;
          return {
            tabs: tabs.length,
            suspended: tabs.filter(t => t.url.includes('/html/suspended.html')).length,
            discarded: tabs.filter(t => t.discarded).length,
            frozen: tabs.filter(t => t.frozen).length,
          };
        })()""" % self._content_tabs_js(ext_id))

    def _apply(self, browser, ctl, ext_id, variant):
        sid = ctl["session"]
        if variant == "control":
            return {"action": "ничего"}

        if variant in ("tgs", "tgs_discard"):
            browser.evaluate(sid, "chrome.runtime.sendMessage({function: 'suspendAllTabs'})")
            info = self._wait_suspended(browser, ctl, ext_id)
            if variant == "tgs_discard":
                info["discarded"] = browser.evaluate(sid, """(async () => {
                  const tabs = (await chrome.tabs.query({})).filter(t =>
                    t.url.includes('/html/suspended.html') && !t.discarded && !t.active);
                  let n = 0;
                  for (const t of tabs) { try { await chrome.tabs.discard(t.id); n++; } catch (e) {} }
                  return n;
                })()""")
            return info

        if variant == "discard":
            n = browser.evaluate(sid, """(async () => {
              const tabs = (await chrome.tabs.query({})).filter(t =>
                /^https?:/.test(t.url) && !t.discarded && !t.active);
              let n = 0;
              for (const t of tabs) { try { await chrome.tabs.discard(t.id); n++; } catch (e) {} }
              return n;
            })()""")
            return {"discarded": n}

        if variant == "freeze":
            n = 0
            for t in browser.page_targets():
                if t["url"].startswith("http"):
                    try:
                        s = browser.attach(t["targetId"])
                        browser.send("Page.setWebLifecycleState", {"state": "frozen"}, session_id=s)
                        n += 1
                    except cdp.CDPError:
                        pass
            return {"frozen": n}

        if variant == "close":
            n = browser.evaluate(sid, """(async () => {
              const ids = (await chrome.tabs.query({})).filter(t => /^https?:/.test(t.url)).map(t => t.id);
              await chrome.tabs.remove(ids);
              return ids.length;
            })()""")
            return {"closed": n}

        raise ValueError(variant)

    def _wait_suspended(self, browser, ctl, ext_id, timeout=180, no_progress=30):
        """TGS suspends through a queue (and requeues tabs that are still
        loading), so wait until every tab is suspended or nothing changed for
        `no_progress` seconds."""
        started = time.time()
        last, last_change = -1, started
        self.status["phase"] = "жду, пока TGS усыпит вкладки"
        while time.time() - started < timeout:
            self._check_stop()
            st = self._tab_state(browser, ctl, ext_id)
            if st["suspended"] != last:
                last, last_change = st["suspended"], time.time()
            if st["suspended"] >= st["tabs"] or time.time() - last_change > no_progress:
                break
            time.sleep(1)
        # discard right after navigation would hit pages that are still loading
        self._sleep(3, "жду загрузку заглушек")
        st = self._tab_state(browser, ctl, ext_id)
        st["wait_s"] = round(time.time() - started)
        if st["suspended"] < st["tabs"]:
            self.log("Внимание: TGS усыпил %d из %d вкладок" % (st["suspended"], st["tabs"]))
        return st
