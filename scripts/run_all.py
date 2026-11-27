#!/usr/bin/env python3
"""Run every tutorial script (01-09) with k6 and report PASS/FAIL from k6's exit code.

k6 exits with 0 when all thresholds pass and 99 when a threshold fails, so this is all we need.
Start the mock API first:   node mock-server/server.js
Run:                        python scripts/run_all.py            (about 4 minutes)
Only some scripts:          python scripts/run_all.py 03 05
k6 is found from the K6 environment variable (path to the binary) or on your PATH.
"""
import os
import shutil
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TESTS = os.path.join(ROOT, "tests")

# Extra arguments that keep the longer scripts short in this check.
EXTRA = {
    "09-claims-summary-workload.js": ["-e", "DURATION=30s", "-e", "THINK_MIN=1", "-e", "THINK_MAX=2"],
}


def k6_cmd():
    exe = os.environ.get("K6") or shutil.which("k6")
    if not exe:
        sys.exit("k6 not found. Install it (Tutorial 01) or set K6 to the path of the k6 binary.")
    return exe


def main():
    wanted = sys.argv[1:]
    k6 = k6_cmd()
    scripts = sorted(f for f in os.listdir(TESTS) if f[:2].isdigit() and f.endswith(".js"))
    results = []
    for s in scripts:
        if wanted and not any(s.startswith(w) for w in wanted):
            continue
        print("\n=== " + s, flush=True)
        t0 = time.time()
        rc = subprocess.call([k6, "run", "-q", os.path.join(TESTS, s)] + EXTRA.get(s, []))
        results.append((s, rc, time.time() - t0))
    print("\n=== Result")
    for s, rc, secs in results:
        verdict = "PASS" if rc == 0 else ("FAIL (thresholds)" if rc == 99 else "FAIL (exit %d)" % rc)
        print("{:<40} {:<18} {:>5.0f} s".format(s, verdict, secs))
    return 0 if all(rc == 0 for _, rc, _ in results) else 1


if __name__ == "__main__":
    sys.exit(main())
