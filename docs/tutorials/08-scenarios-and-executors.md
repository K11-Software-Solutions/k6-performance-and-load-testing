# 08 · Scenarios and executors

> **Goal:** shape the load precisely with scenarios: several workloads in one test, each with its own executor, timing, function and tags.
>
> **Script:** `tests/08-scenarios-and-executors.js` (six scenarios, one after another, about 70 s)

## Scenarios

```javascript
export const options = {
  scenarios: {
    browse: { executor: 'constant-vus', vus: 10, duration: '5m', exec: 'browse' },
    reports: { executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: '5m',
               preAllocatedVUs: 10, maxVUs: 50, exec: 'runReport', startTime: '30s' },
  },
};
```

| Key | Meaning |
|---|---|
| `executor` | The load shape (table below) |
| `exec` | Which exported function this scenario runs (default: `default`) |
| `startTime` | Delay before this scenario starts (run scenarios one after another, or add a spike) |
| `gracefulStop` / `gracefulRampDown` | Time to let running iterations finish before stopping them |
| `tags`, `env` | Tags and environment variables for just this scenario |

Scenarios run **in parallel** unless you stagger them with `startTime`. Each scenario's samples are tagged `scenario:<name>`, so you can set thresholds per scenario.

## The executors

| Executor | Model | Controls | Typical use |
|---|---|---|---|
| `shared-iterations` | closed | A total number of iterations shared by the VUs | "Run these 1,000 requests as fast as possible" |
| `per-vu-iterations` | closed | Each VU does exactly N iterations | Each user processes its own data set |
| `constant-vus` | closed | A fixed number of VUs for a duration | Smoke tests, simple load |
| `ramping-vus` | closed | VUs follow stages (up, hold, down) | Classic load, soak and spike tests |
| `constant-arrival-rate` | **open** | N iterations per time unit | "50 requests per second" targets, stress steps |
| `ramping-arrival-rate` | **open** | The rate follows stages | Breakpoint and stress tests |

(k6 v2 removed the `externally-controlled` executor.)

## What our run showed

| Scenario | Setting | Iterations |
|---|---|---|
| shared_iterations | 20 total, 4 VUs | 20 |
| per_vu_iterations | 5 each × 4 VUs | 20 |
| constant_vus | 5 VUs, 10 s, 0.5 s think time | 95 |
| ramping_vus | 0 → 8 → 8 → 0 over 13 s | 138 |
| constant_arrival_rate | 10/s for 10 s | 101 |
| ramping_arrival_rate | 2 → 15 → 15 → 2 per second over 13 s | 142 |

`dropped_iterations` was 0: k6 always had a free VU when an arrival was due.

## Arrival-rate sizing

For arrival-rate executors you choose `preAllocatedVUs` and `maxVUs`. A useful estimate is **VUs needed ≈ rate × iteration duration** (Little's Law again). 10 iterations per second × 0.5 s each = 5 VUs. Give some headroom with `maxVUs`. If the system slows down, k6 needs more VUs to keep the rate, and when it hits `maxVUs` it starts dropping iterations.

## Stages

```javascript
stages: [
  { duration: '5s', target: 8 },  // ramp up to 8 VUs
  { duration: '5s', target: 8 },  // hold
  { duration: '3s', target: 0 },  // ramp down
],
```

`target` is VUs for `ramping-vus` and iterations per `timeUnit` for `ramping-arrival-rate`.

## Run it

```powershell
k6 run tests/08-scenarios-and-executors.js
```

**Next:** [09 · The Claims Summary workload model](09-claims-summary-workload.md)
