#!/usr/bin/env python3
"""
TGS Memory Lab — real resource measurements for Chrome on macOS.

  python3 dev/scripts/mem_watch.py              dashboard at http://127.0.0.1:8765
  python3 dev/scripts/mem_watch.py bench ...    automatic A/B in the terminal
  python3 dev/scripts/mem_watch.py snapshot     current numbers, once

No dependencies (Python 3.9+, macOS). Results: ~/.tgs-memlab/results.json
"""

import argparse
import os
import sys
import time
import webbrowser

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from memlab.metrics import Sampler, find_browsers  # noqa: E402
from memlab.bench import (Bench, Store, VARIANTS, SUMMARY_METRICS,  # noqa: E402
                          RESULTS_FILE, summarize_session)

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def cmd_serve(args):
    from memlab.server import make_server
    sampler = Sampler(interval=args.interval)
    sampler.start()
    server = make_server(sampler, REPO, args.port)
    url = "http://127.0.0.1:%d" % args.port
    print("TGS Memory Lab: %s  (Ctrl+C — выход)" % url)
    print("Результаты сохраняются в %s" % RESULTS_FILE)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


def _fmt(v, unit=""):
    if v is None:
        return "—"
    if abs(v) >= 100:
        return "%.0f%s" % (v, unit)
    return "%.1f%s" % (v, unit)


def print_session(session):
    summary = summarize_session(session)
    variants = [v for v, _ in VARIANTS if v in summary]
    names = dict(VARIANTS)
    print("\nΔ = после − до (медиана по повторам). Чистый эффект = Δ варианта − Δ контроля.\n")
    head = "%-30s" % "Метрика" + "".join("%-22s" % names[v][:20] for v in variants)
    print(head)
    print("-" * len(head))
    for key, label, unit in SUMMARY_METRICS:
        cells = []
        for v in variants:
            row = summary[v]
            d = row["delta"].get(key)
            net = row["net"].get(key)
            cell = ("%+.1f" % d if d is not None else "—")
            if v != "control" and net is not None:
                cell += " (%+.1f)" % net
            cells.append("%-22s" % cell)
        print("%-30s" % (label + (", " + unit if unit else "")) + "".join(cells))
    print()


def cmd_bench(args):
    sampler = Sampler(interval=args.interval)
    sampler.start()
    urls = None
    if args.urls:
        with open(args.urls) as f:
            urls = [l.strip() for l in f if l.strip() and not l.startswith("#")]
    bench = Bench(sampler, Store(), REPO, {
        "variants": args.variants.split(","),
        "repeats": args.repeats,
        "urls": urls,
        "load_wait": args.load_wait,
        "settle": args.settle,
        "window": args.window,
        "chrome": args.chrome,
        "label": args.label,
    })
    try:
        session = bench.run()
    except KeyboardInterrupt:
        bench.stop_event.set()
        return
    print_session(session)


def cmd_snapshot(args):
    sampler = Sampler()
    sampler.take_sample()
    time.sleep(2)
    s = sampler.take_sample()
    sysm = s["sys"]
    print("Система: свободно %s%%, давление %s, swap %s МБ, сжато %s МБ, из swap %s стр/с" % (
        sysm["free_pct"], {1: "норма", 2: "предупреждение", 4: "критическое"}.get(sysm["pressure"], sysm["pressure"]),
        _fmt(sysm["swap_used"]), _fmt(sysm["compressor"]), _fmt(sysm.get("swapins_ps"))))
    for key, inst in s["inst"].items():
        print("\n%s (%s), pid %s" % (inst["app"], inst["label"], key))
        print("  память %s МБ: вкладки %s, расширения %s, GPU %s, browser %s, служебные %s" % (
            _fmt(inst["fp"]), _fmt(inst["fp_renderer"]), _fmt(inst["fp_extension"]),
            _fmt(inst["fp_gpu"]), _fmt(inst["fp_browser"]), _fmt(inst["fp_utility"])))
        print("  процессов %d, CPU %s%%, пробуждений %s/с" % (
            inst["nprocs"], _fmt(inst.get("cpu_pct")), _fmt(inst.get("wakeups_ps"))))
    if not s["inst"]:
        print("Chrome не запущен")


def main():
    p = argparse.ArgumentParser(description="TGS Memory Lab")
    p.add_argument("--interval", type=float, default=2.0, help="период замеров, с")
    sub = p.add_subparsers(dest="cmd")

    ps = sub.add_parser("serve", help="дашборд (по умолчанию)")
    ps.add_argument("--port", type=int, default=8765)
    ps.add_argument("--no-open", action="store_true")

    pb = sub.add_parser("bench", help="автоматический A/B-тест")
    pb.add_argument("--variants", default="control,tgs,discard",
                    help="через запятую: " + ",".join(v for v, _ in VARIANTS))
    pb.add_argument("--repeats", type=int, default=2)
    pb.add_argument("--urls", help="файл со списком URL (по умолчанию memlab/bench_urls.txt)")
    pb.add_argument("--load-wait", type=int, default=60, help="ожидание загрузки страниц, с")
    pb.add_argument("--settle", type=int, default=60, help="стабилизация после действия, с")
    pb.add_argument("--window", type=int, default=45, help="длина окна замера, с")
    pb.add_argument("--chrome", help="путь к исполняемому файлу Chrome")
    pb.add_argument("--label", default="", help="подпись сессии, напр. 'лёгкий suspended.html'")

    sub.add_parser("snapshot", help="текущие цифры один раз")

    args = p.parse_args()
    if args.cmd == "bench":
        cmd_bench(args)
    elif args.cmd == "snapshot":
        cmd_snapshot(args)
    else:
        if args.cmd is None:
            args.port, args.no_open = 8765, False
        cmd_serve(args)


if __name__ == "__main__":
    main()
