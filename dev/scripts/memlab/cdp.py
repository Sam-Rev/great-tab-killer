"""
Launch a separate Chrome instance and drive it over the DevTools protocol via
--remote-debugging-pipe (fd 3/4, NUL-separated JSON). The pipe transport is
what allows Extensions.loadUnpacked, which is the only way left to load an
unpacked extension from the command line in branded Chrome 137+.
"""

import fcntl
import json
import os
import shutil
import subprocess
import threading
import time

DEFAULT_CHROME_PATHS = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
]


class CDPError(Exception):
    pass


def find_chrome(explicit=None):
    if explicit:
        if not os.path.exists(explicit):
            raise CDPError("Chrome не найден: " + explicit)
        return explicit
    for p in DEFAULT_CHROME_PATHS:
        if os.path.exists(p):
            return p
    raise CDPError("Не найден Chrome. Укажите путь через --chrome")


class Browser:
    def __init__(self, chrome_path, profile_dir, extra_args=None):
        self.profile_dir = profile_dir
        # parent -> chrome (chrome reads fd 3), chrome -> parent (chrome writes fd 4)
        to_chrome_r, self._to_chrome_w = os.pipe()
        self._from_chrome_r, from_chrome_w = os.pipe()

        # subprocess closes extra fds *after* preexec_fn, so instead of
        # pass_fds rely on close_fds=False: everything os.pipe()/open() made
        # is non-inheritable (CLOEXEC), and only the dup2'ed 3/4 survive exec
        def setup_fds():
            a = fcntl.fcntl(to_chrome_r, fcntl.F_DUPFD, 10)
            b = fcntl.fcntl(from_chrome_w, fcntl.F_DUPFD, 10)
            os.dup2(a, 3)
            os.dup2(b, 4)

        args = [
            chrome_path,
            "--user-data-dir=" + profile_dir,
            "--remote-debugging-pipe",
            "--enable-unsafe-extension-debugging",
            "--no-first-run",
            "--no-default-browser-check",
            "--hide-crash-restore-bubble",
            "--disable-search-engine-choice-screen",
        ] + (extra_args or []) + ["about:blank"]
        self.proc = subprocess.Popen(
            args,
            close_fds=False,
            preexec_fn=setup_fds,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        os.close(to_chrome_r)
        os.close(from_chrome_w)
        self.pid = self.proc.pid

        self._next_id = 0
        self._pending = {}
        self._cond = threading.Condition()
        self._write_lock = threading.Lock()
        self._closed = False
        threading.Thread(target=self._reader, daemon=True).start()

    # ---------------------------------------------------------------
    def _reader(self):
        buf = b""
        while True:
            try:
                chunk = os.read(self._from_chrome_r, 1 << 16)
            except OSError:
                chunk = b""
            if not chunk:
                break
            buf += chunk
            while b"\0" in buf:
                raw, buf = buf.split(b"\0", 1)
                try:
                    msg = json.loads(raw.decode("utf-8", "replace"))
                except ValueError:
                    continue
                if "id" in msg:
                    with self._cond:
                        self._pending[msg["id"]] = msg
                        self._cond.notify_all()
        with self._cond:
            self._closed = True
            self._cond.notify_all()

    def send(self, method, params=None, session_id=None, timeout=60):
        with self._cond:
            self._next_id += 1
            mid = self._next_id
        msg = {"id": mid, "method": method, "params": params or {}}
        if session_id:
            msg["sessionId"] = session_id
        data = json.dumps(msg).encode() + b"\0"
        with self._write_lock:
            try:
                os.write(self._to_chrome_w, data)
            except OSError as e:
                raise CDPError("Chrome закрылся: %s" % e)
        deadline = time.time() + timeout
        with self._cond:
            while mid not in self._pending:
                if self._closed:
                    raise CDPError("Chrome закрылся во время " + method)
                left = deadline - time.time()
                if left <= 0:
                    raise CDPError("Таймаут CDP: " + method)
                self._cond.wait(left)
            resp = self._pending.pop(mid)
        if "error" in resp:
            raise CDPError("%s: %s" % (method, resp["error"].get("message")))
        return resp.get("result", {})

    # ---------------------------------------------------------------
    def wait_ready(self, timeout=30):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                return self.send("Browser.getVersion", timeout=5)
            except CDPError:
                if self.proc.poll() is not None:
                    raise CDPError("Chrome завершился при запуске")
                time.sleep(0.5)
        raise CDPError("Chrome не ответил за %d с" % timeout)

    def load_unpacked(self, path):
        return self.send("Extensions.loadUnpacked", {"path": path})["id"]

    def page_targets(self):
        infos = self.send("Target.getTargets")["targetInfos"]
        return [t for t in infos if t["type"] == "page"]

    def open_tab(self, url, background=True):
        return self.send("Target.createTarget", {"url": url, "background": background})["targetId"]

    def close_target(self, target_id):
        try:
            self.send("Target.closeTarget", {"targetId": target_id}, timeout=10)
        except CDPError:
            pass

    def attach(self, target_id):
        return self.send("Target.attachToTarget", {"targetId": target_id, "flatten": True})["sessionId"]

    def evaluate(self, session_id, expression, timeout=60):
        res = self.send("Runtime.evaluate", {
            "expression": expression,
            "awaitPromise": True,
            "returnByValue": True,
        }, session_id=session_id, timeout=timeout)
        if "exceptionDetails" in res:
            details = res["exceptionDetails"]
            text = (details.get("exception") or {}).get("description") or details.get("text")
            raise CDPError("JS: %s" % text)
        return (res.get("result") or {}).get("value")

    def close(self, remove_profile=True):
        try:
            self.send("Browser.close", timeout=10)
        except CDPError:
            pass
        try:
            self.proc.wait(20)
        except subprocess.TimeoutExpired:
            self.proc.kill()
            self.proc.wait(10)
        for fd in (self._to_chrome_w, self._from_chrome_r):
            try:
                os.close(fd)
            except OSError:
                pass
        if remove_profile:
            shutil.rmtree(self.profile_dir, ignore_errors=True)
