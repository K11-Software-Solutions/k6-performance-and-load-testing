# Sample results

Real results from an **open-model step test** against the local mock API on one laptop (k6 v2.4.0, Windows 11), used in [Tutorial 14](../../docs/tutorials/14-reading-results-and-finding-bottlenecks.md). They are for learning to read results, **not benchmarks** of any real system.

`open-model-step-test/`:

- Mock settings: `POOL_SIZE=4 QUEUE_TIMEOUT_MS=2000`
- Command: `python scripts/step_load.py --rates 4 8 12 16 20 24 --duration 90s --html-for-last`
- `step-summary.md` / `.csv`: one row per step (sessions per second)
- `rate-N.json`: the full k6 end-of-test summary for each step (`--summary-export`), including the `tx_*` transaction Trends

Columns: *Max VUs* is `vus_max`; *Dropped* is `dropped_iterations`; *Server max queue* is the longest connection queue the mock has seen since it started (from `/metrics`); *Server 503s* is the number of 503 responses the mock sent during that step; *k6 exit* 99 means thresholds failed.

Your numbers will differ a little; the shape of the curves should not.
