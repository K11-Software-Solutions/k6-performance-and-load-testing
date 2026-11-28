#!/usr/bin/env python3
"""Step (stress) test with an OPEN workload model: raise the arrival rate step by step and build one table.

Each step runs tests/09-claims-summary-workload.js with PROFILE=stress (constant-arrival-rate): k6 starts
RATE new iterations per second whatever the response times. One iteration = log in + one weighted action.

1. Start the mock with a small connection pool so the limit appears at laptop-friendly load:
       POOL_SIZE=4 QUEUE_TIMEOUT_MS=2000 node mock-server/server.js            (Git Bash / macOS / Linux)
       $env:POOL_SIZE=4; $env:QUEUE_TIMEOUT_MS=2000; node mock-server/server.js (PowerShell)
2. Run:
       python scripts/step_load.py --rates 4 8 12 16 20 24 --duration 90s

Writes results/step-load/rate-<N>.json (k6 --summary-export) and step-summary.md / .csv.
"""
import argparse
import csv
import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from run_all import k6_cmd  # noqa: E402


def read_metrics(base):
    try:
        with urllib.request.urlopen(base + "/metrics", timeout=5) as r:
            return json.load(r)
    except Exception:
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--rates", nargs="+", type=int, default=[4, 8, 12, 16, 20, 24],
                    help="iterations (sessions) started per second, one step each")
    ap.add_argument("--duration", default="90s")
    ap.add_argument("--base-url", default="http://localhost:3000")
    ap.add_argument("--out", default=os.path.join(ROOT, "results", "step-load"))
    ap.add_argument("--html-for-last", action="store_true", help="export the k6 web dashboard for the last step")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    k6 = k6_cmd()
    rows = []
    for i, rate in enumerate(a.rates):
        summary = os.path.join(a.out, "rate-{}.json".format(rate))
        before = read_metrics(a.base_url)
        env = dict(os.environ)
        if a.html_for_last and i == len(a.rates) - 1:
            env["K6_WEB_DASHBOARD"] = "true"
            env["K6_WEB_DASHBOARD_EXPORT"] = os.path.join(a.out, "dashboard-rate-{}.html".format(rate))
        print("\n=== Step {}/{}: {} sessions per second".format(i + 1, len(a.rates), rate), flush=True)
        rc = subprocess.call([k6, "run", "-q", "-e", "PROFILE=stress", "-e", "RATE={}".format(rate),
                              "-e", "DURATION=" + a.duration, "-e", "BASE_URL=" + a.base_url,
                              "--summary-export", summary,
                              os.path.join(ROOT, "tests", "09-claims-summary-workload.js")], env=env)
        after = read_metrics(a.base_url)
        m = json.load(open(summary))["metrics"]
        d = m["http_req_duration"]
        failed_rate = m["http_req_failed"]["value"]
        reqs = m["http_reqs"]["rate"]
        rows.append({
            "sessions_per_s": rate,
            "requests": m["http_reqs"]["count"],
            "avg_ms": round(d["avg"]),
            "p90_ms": round(d["p(90)"]),
            "p95_ms": round(d["p(95)"]),
            "p99_ms": round(d["p(99)"]),
            "throughput_per_s": round(reqs, 1),
            "error_pct": round(100 * failed_rate, 2),
            "ok_throughput_per_s": round(reqs * (1 - failed_rate), 1),
            "claims_p95_ms": round(m["tx_claims_summary"]["p(95)"]) if "tx_claims_summary" in m else "",
            "max_vus": m["vus_max"].get("value", m["vus_max"].get("max", "")),
            "dropped_iterations": m.get("dropped_iterations", {}).get("count", 0),
            "server_max_queue": after.get("maxQueueSeen", ""),
            "server_503s_this_step": (after.get("rejected503", 0) - before.get("rejected503", 0)) if after else "",
            "k6_exit_code": rc,
        })

    cols = list(rows[0].keys())
    with open(os.path.join(a.out, "step-summary.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    head = ["Sessions/s", "Requests", "Avg (ms)", "p90 (ms)", "p95 (ms)", "p99 (ms)", "Throughput (req/s)", "Error %",
            "Successful (req/s)", "Claims p95 (ms)", "Max VUs", "Dropped iterations", "Server max queue",
            "Server 503s", "k6 exit"]
    md = ["| " + " | ".join(head) + " |", "|" + "---:|" * len(head)]
    md += ["| " + " | ".join(str(r[c]) for c in cols) + " |" for r in rows]
    text = "\n".join(md)
    with open(os.path.join(a.out, "step-summary.md"), "w", encoding="utf-8", newline="\n") as f:
        f.write(text + "\n")
    print("\n" + text)
    print("\nk6 exit 99 = thresholds failed (SLO broken). 'Server max queue' is the highest seen since the mock started.")


if __name__ == "__main__":
    main()
