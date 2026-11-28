# 09 · The Claims Summary workload model

> **Goal:** build the full, realistic workload from the mock assessment in k6, and run it as a smoke, load, stress, spike or soak test with one environment variable.
>
> **Script:** `tests/09-claims-summary-workload.js`

## The model

| Element | Value |
|---|---|
| Users at peak | 300 concurrent analysts |
| Session | Log in, then 4 actions with 3–8 s think time |
| Mix | Dashboard 50%, Claims Summary 35%, Export 15% |
| Data | A new analyst (and their provider) per session from `users.csv`; a random date range |
| SLO | Claims Summary p95 under 3 s; errors under 1% |

## How the script is built

```javascript
export default function () {
  const user = users[exec.scenario.iterationInTest % users.length];
  const token = login(user.username, user.password);
  if (!token) return; // guard: no cascade of 401s after a failed login

  for (let i = 0; i < ACTIONS; i++) {
    const r = Math.random() * 100;
    if (r < MIX_DASHBOARD) dashboard(token);
    else if (r < MIX_DASHBOARD + MIX_CLAIMS) claims(token, user);
    else exportReport(token, user);
    sleep(between(THINK_MIN, THINK_MAX));
  }
}
```

- **One iteration = one user session.**
- The **weighted mix** is a random number and an `if`. Each action is a `group()` named like a JMeter transaction (`TX03 Claims Summary`) and records its own Trend (`tx_claims_summary`).
- **Guards** (`if (!token) return;`, and `if (!check(...)) return;` inside the export) stop one failure turning into a chain of meaningless follow-up errors. The JMeter repo's worked example shows how badly cascade errors distort results.
- The export **polls** every 0.5 s until READY (max 10 polls), then downloads the CSV.

## The SLO as thresholds

```javascript
thresholds: {
  tx_claims_summary: ['p(95)<3000'],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
},
summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
```

`summaryTrendStats` adds p(99) and count to the summary, so it reads like JMeter's Aggregate Report.

## Profiles: one script, every test type

| `PROFILE` | Executor | Default shape | Useful overrides |
|---|---|---|---|
| `smoke` (default) | `constant-vus` | 5 VUs, 1 min | `VUS`, `DURATION` |
| `load` | `ramping-vus` | 0 → 300 over 10 min, hold 1 h, ramp down | `VUS`, `RAMP`, `DURATION` |
| `stress` | `constant-arrival-rate` (**open**) | `RATE` sessions/s for 90 s, 1 action per session, no think time | `RATE`, `DURATION`, `MAX_VUS` |
| `spike` | `ramping-vus` | 10 VUs → **70** in 5 s, hold 1 min, back to 10, hold 1 min | `VUS`, `SPIKE_VUS` |
| `soak` | `ramping-vus` | 20 VUs for 4 h | `VUS`, `DURATION` |

Also: `THINK_MIN`, `THINK_MAX`, `ACTIONS_PER_SESSION`, `MIX_DASHBOARD`, `MIX_CLAIMS`, `BASE_URL`.

```powershell
k6 run tests/09-claims-summary-workload.js
k6 run -e PROFILE=load -e VUS=50 -e RAMP=1m -e DURATION=5m tests/09-claims-summary-workload.js
k6 run -e PROFILE=stress -e RATE=12 tests/09-claims-summary-workload.js
k6 run -e PROFILE=spike tests/09-claims-summary-workload.js
```

Scale `load` down on a laptop. 300 VUs for an hour against a local mock teaches little.

## Why stress uses an open model

In the closed `smoke`/`load` profiles, when the system slows down, VUs wait and **send less**, so the system gets breathing room. In the open `stress` profile, sessions keep **arriving at `RATE` per second** no matter what, so queues build exactly as they would with real traffic. Tutorial 14 runs a step test with this profile and compares it with the JMeter repo's closed-model results.

## A smoke run (our numbers)

5 VUs, 30 s, 1–2 s think time against the default mock: `tx_claims_summary` p95 345 ms, `tx_dashboard` p95 85 ms, `tx_export_report` p95 1.93 s (it includes about 1.5 s waiting for the export to be ready), 0% failed requests, all thresholds passed.

**Next:** [10 · Results and reports](10-results-and-reports.md)
