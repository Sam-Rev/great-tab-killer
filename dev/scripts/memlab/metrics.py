"""
Real resource metrics for Chrome-family browsers on macOS, read straight from
the kernel. No dependencies, no root.

Why not RSS (`ps -o rss`): RSS only counts pages that are in RAM right now.
Memory that macOS compressed or swapped out disappears from RSS, so under
memory pressure RSS can understate Chrome by 5x. `phys_footprint` is what
Activity Monitor shows in its "Memory" column: private memory including the
compressed and swapped part, without double-counting shared pages.
"""

import ctypes
import re
import subprocess
import threading
import time
from collections import deque

_libproc = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
_libc = ctypes.CDLL("/usr/lib/libSystem.dylib", use_errno=True)


class _Timebase(ctypes.Structure):
    _fields_ = [("numer", ctypes.c_uint32), ("denom", ctypes.c_uint32)]


_tb = _Timebase()
_libc.mach_timebase_info(ctypes.byref(_tb))
# rusage cpu times are mach ticks: 1 tick = 1ns on Intel, 41.67ns on Apple Silicon
NS_PER_TICK = _tb.numer / _tb.denom

_RUSAGE_V4_FIELDS = [
    "user_time", "system_time", "pkg_idle_wkups", "interrupt_wkups", "pageins",
    "wired_size", "resident_size", "phys_footprint", "proc_start_abstime",
    "proc_exit_abstime", "child_user_time", "child_system_time",
    "child_pkg_idle_wkups", "child_interrupt_wkups", "child_pageins",
    "child_elapsed_abstime", "diskio_bytesread", "diskio_byteswritten",
    "cpu_time_qos_default", "cpu_time_qos_maintenance", "cpu_time_qos_background",
    "cpu_time_qos_utility", "cpu_time_qos_legacy", "cpu_time_qos_user_initiated",
    "cpu_time_qos_user_interactive", "billed_system_time", "serviced_system_time",
    "logical_writes", "lifetime_max_phys_footprint", "instructions", "cycles",
    "billed_energy", "serviced_energy", "interval_max_phys_footprint",
    "runnable_time",
]


class _RusageV4(ctypes.Structure):
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [
        (name, ctypes.c_uint64) for name in _RUSAGE_V4_FIELDS
    ]


_RUSAGE_INFO_V4 = 4


def proc_usage(pid):
    """Cumulative counters of one process, or None if it is gone."""
    ru = _RusageV4()
    if _libproc.proc_pid_rusage(int(pid), _RUSAGE_INFO_V4, ctypes.byref(ru)) != 0:
        return None
    return {
        "footprint": ru.phys_footprint,
        "resident": ru.resident_size,
        "cpu_ns": (ru.user_time + ru.system_time) * NS_PER_TICK,
        "wakeups": ru.pkg_idle_wkups + ru.interrupt_wkups,
        "energy_nj": ru.billed_energy,
    }


# ------------------------------------------------------------------
# system-wide memory
# ------------------------------------------------------------------

def _sysctl_int(name):
    val = ctypes.c_uint64(0)
    size = ctypes.c_size_t(ctypes.sizeof(val))
    if _libc.sysctlbyname(name.encode(), ctypes.byref(val), ctypes.byref(size), None, 0) != 0:
        return None
    # some of these are 32-bit ints
    return val.value & 0xFFFFFFFF if size.value == 4 else val.value


class _XswUsage(ctypes.Structure):
    _fields_ = [
        ("total", ctypes.c_uint64), ("avail", ctypes.c_uint64),
        ("used", ctypes.c_uint64), ("pagesize", ctypes.c_uint32),
        ("encrypted", ctypes.c_bool),
    ]


def _swap_used():
    xsw = _XswUsage()
    size = ctypes.c_size_t(ctypes.sizeof(xsw))
    if _libc.sysctlbyname(b"vm.swapusage", ctypes.byref(xsw), ctypes.byref(size), None, 0) != 0:
        return None
    return xsw.used


_VM_STAT_KEYS = {
    "Pages occupied by compressor": "compressor_pages",
    "Swapins": "swapins",
    "Swapouts": "swapouts",
    "Decompressions": "decompressions",
    "Compressions": "compressions",
    "Pageouts": "pageouts",
}


def _vm_stat():
    out = subprocess.run(["vm_stat"], capture_output=True, text=True).stdout
    page = 16384
    m = re.search(r"page size of (\d+) bytes", out)
    if m:
        page = int(m.group(1))
    res = {"page_size": page}
    for line in out.splitlines():
        key, _, val = line.partition(":")
        key = key.strip().strip('"')
        if key in _VM_STAT_KEYS:
            try:
                res[_VM_STAT_KEYS[key]] = int(val.strip().rstrip("."))
            except ValueError:
                pass
    return res


TOTAL_RAM = _sysctl_int("hw.memsize") or 0


def system_snapshot():
    vm = _vm_stat()
    return {
        "total": TOTAL_RAM,
        # same number `memory_pressure` prints as "free percentage"
        "free_pct": _sysctl_int("kern.memorystatus_level"),
        # 1 = normal, 2 = warning, 4 = critical
        "pressure": _sysctl_int("kern.memorystatus_vm_pressure_level"),
        "swap_used": _swap_used(),
        "compressor": vm.get("compressor_pages", 0) * vm["page_size"],
        "swapins": vm.get("swapins", 0),
        "swapouts": vm.get("swapouts", 0),
        "decompressions": vm.get("decompressions", 0),
        "compressions": vm.get("compressions", 0),
    }


# ------------------------------------------------------------------
# chrome process discovery
# ------------------------------------------------------------------

BROWSER_APPS = (
    "Google Chrome", "Google Chrome Canary", "Google Chrome Beta",
    "Google Chrome Dev", "Google Chrome for Testing", "Chromium",
    "Microsoft Edge", "Brave Browser",
)
_ROOT_RE = re.compile(r"^(/.*?/([^/]+)\.app/Contents/MacOS/\2)(?:\s|$)")
_UDD_RE = re.compile(r"--user-data-dir=(.+?)(?=\s--|$)")

PROC_TYPES = ("browser", "renderer", "extension", "gpu", "utility", "other")


def _classify(cmd):
    if "--type=renderer" in cmd:
        return "extension" if "--extension-process" in cmd else "renderer"
    if "--type=gpu-process" in cmd:
        return "gpu"
    if "--type=utility" in cmd:
        return "utility"
    return "other"


def _list_processes():
    out = subprocess.run(
        ["ps", "-A", "-ww", "-o", "pid=,ppid=,command="],
        capture_output=True, text=True,
    ).stdout
    procs = {}
    for line in out.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) < 3:
            continue
        try:
            procs[int(parts[0])] = (int(parts[1]), parts[2])
        except ValueError:
            continue
    return procs


def find_browsers():
    """{root_pid: {app, label, pids: {pid: type}}} for every running browser instance."""
    procs = _list_processes()
    roots = {}
    for pid, (_, cmd) in procs.items():
        m = _ROOT_RE.match(cmd)
        if m and m.group(2) in BROWSER_APPS and "--type=" not in cmd:
            udd = _UDD_RE.search(cmd)
            label = "профиль: " + udd.group(1).rstrip("/").split("/")[-1] if udd else "основной профиль"
            roots[pid] = {"app": m.group(2), "label": label, "pids": {pid: "browser"}}
    if not roots:
        return roots
    for pid, (ppid, cmd) in procs.items():
        if pid in roots:
            continue
        # helpers are direct children of the browser process, but walk a few
        # levels in case something sits in between
        parent, depth = ppid, 0
        while parent not in roots and parent in procs and depth < 4:
            parent, depth = procs[parent][0], depth + 1
        if parent in roots:
            roots[parent]["pids"][pid] = _classify(cmd)
    return roots


# ------------------------------------------------------------------
# sampler
# ------------------------------------------------------------------

MB = 1048576.0


class Sampler(threading.Thread):
    """Samples system + every browser instance every `interval` seconds.

    Each sample stores levels (memory) and rates computed from the delta of
    cumulative kernel counters since the previous sample, so CPU and wakeups
    are exact totals over the interval, not instantaneous guesses.
    """

    def __init__(self, interval=2.0, history_seconds=4 * 3600):
        super().__init__(daemon=True)
        self.interval = interval
        self.samples = deque(maxlen=int(history_seconds / interval))
        self.latest_procs = {}  # root_pid -> [per-process rows] of the last sample
        self.lock = threading.Lock()
        self._prev_proc = {}
        self._prev_sys = None
        self._prev_t = None
        self._stop_evt = threading.Event()
        self.new_sample = threading.Condition()

    def stop(self):
        self._stop_evt.set()

    def run(self):
        while not self._stop_evt.is_set():
            started = time.time()
            try:
                self.take_sample()
            except Exception as e:  # keep sampling no matter what
                print("sampler error:", e)
            self._stop_evt.wait(max(0.2, self.interval - (time.time() - started)))

    def take_sample(self):
        now = time.time()
        sysm = system_snapshot()
        browsers = find_browsers()
        dt = (now - self._prev_t) if self._prev_t else None

        sample = {"t": now, "sys": self._sys_metrics(sysm, dt), "inst": {}}
        cur_proc = {}
        latest_procs = {}
        for root, info in browsers.items():
            fp = dict.fromkeys(PROC_TYPES, 0)
            counts = dict.fromkeys(PROC_TYPES, 0)
            d_cpu = d_wk = d_en = 0
            rows = []
            for pid, ptype in info["pids"].items():
                u = proc_usage(pid)
                if not u:
                    continue
                cur_proc[pid] = u
                fp[ptype] += u["footprint"]
                counts[ptype] += 1
                prev = self._prev_proc.get(pid)
                cpu_pct = None
                if prev and dt:
                    d_cpu += max(0, u["cpu_ns"] - prev["cpu_ns"])
                    d_wk += max(0, u["wakeups"] - prev["wakeups"])
                    d_en += max(0, u["energy_nj"] - prev["energy_nj"])
                    cpu_pct = max(0, u["cpu_ns"] - prev["cpu_ns"]) / 1e9 / dt * 100
                rows.append({
                    "pid": pid, "type": ptype,
                    "fp": round(u["footprint"] / MB, 1),
                    "rss": round(u["resident"] / MB, 1),
                    "cpu": round(cpu_pct, 1) if cpu_pct is not None else None,
                })
            rows.sort(key=lambda r: -r["fp"])
            latest_procs[root] = rows
            total = sum(fp.values())
            inst = {
                "app": info["app"], "label": info["label"],
                "fp": round(total / MB, 1),
                "nprocs": sum(counts.values()),
                "n_renderer": counts["renderer"],
                "n_extension": counts["extension"],
            }
            for t in PROC_TYPES:
                inst["fp_" + t] = round(fp[t] / MB, 1)
            if dt:
                inst["cpu_pct"] = round(d_cpu / 1e9 / dt * 100, 2)
                inst["wakeups_ps"] = round(d_wk / dt, 1)
                # billed_energy units are not documented reliably; use it only
                # as a relative index (same machine, same Chrome = comparable)
                inst["energy_idx"] = round(d_en / 1e6 / dt, 1)
            sample["inst"][str(root)] = inst

        self._prev_proc = cur_proc
        self._prev_sys = sysm
        self._prev_t = now
        with self.lock:
            self.samples.append(sample)
            self.latest_procs = latest_procs
        with self.new_sample:
            self.new_sample.notify_all()
        return sample

    def _sys_metrics(self, s, dt):
        res = {
            "free_pct": s["free_pct"],
            "pressure": s["pressure"],
            "swap_used": round((s["swap_used"] or 0) / MB, 1),
            "compressor": round(s["compressor"] / MB, 1),
            "total": round(s["total"] / MB, 1),
        }
        p = self._prev_sys
        if p and dt:
            for k in ("swapins", "swapouts", "decompressions", "compressions"):
                res[k + "_ps"] = round(max(0, s[k] - p[k]) / dt, 1)
        return res

    # --------------------------------------------------------------
    def samples_between(self, t0, t1):
        with self.lock:
            return [s for s in self.samples if t0 <= s["t"] <= t1]

    def samples_since(self, t0):
        with self.lock:
            return [s for s in self.samples if s["t"] > t0]

    def wait_next(self, timeout=None):
        with self.new_sample:
            self.new_sample.wait(timeout)


# ------------------------------------------------------------------
# window summaries (used by both the manual and the automatic A/B)
# ------------------------------------------------------------------

# levels -> median over the window; rates -> mean over the window
INST_LEVELS = ["fp"] + ["fp_" + t for t in PROC_TYPES] + ["nprocs", "n_renderer", "n_extension"]
INST_RATES = ["cpu_pct", "wakeups_ps", "energy_idx"]
SYS_LEVELS = ["free_pct", "swap_used", "compressor"]
SYS_RATES = ["swapins_ps", "swapouts_ps", "decompressions_ps", "compressions_ps"]


def _median(vals):
    vals = sorted(vals)
    if not vals:
        return None
    n = len(vals)
    return vals[n // 2] if n % 2 else (vals[n // 2 - 1] + vals[n // 2]) / 2


def _mean(vals):
    return sum(vals) / len(vals) if vals else None


def summarize(samples, inst_key):
    inst_key = str(inst_key)
    res = {"n": 0}
    rows = [s["inst"][inst_key] for s in samples if inst_key in s["inst"]]
    res["n"] = len(rows)
    for k in INST_LEVELS:
        res[k] = _median([r[k] for r in rows if r.get(k) is not None])
    for k in INST_RATES:
        res[k] = _mean([r[k] for r in rows if r.get(k) is not None])
    sysrows = [s["sys"] for s in samples]
    for k in SYS_LEVELS:
        res["sys_" + k] = _median([r[k] for r in sysrows if r.get(k) is not None])
    for k in SYS_RATES:
        res["sys_" + k] = _mean([r[k] for r in sysrows if r.get(k) is not None])
    pressures = [r["pressure"] for r in sysrows if r.get("pressure")]
    res["sys_pressure_max"] = max(pressures) if pressures else None
    return res


def diff(a, b):
    out = {}
    for k, v in b.items():
        if k == "n":
            continue
        if isinstance(v, (int, float)) and isinstance(a.get(k), (int, float)):
            out[k] = v - a[k]
    return out
