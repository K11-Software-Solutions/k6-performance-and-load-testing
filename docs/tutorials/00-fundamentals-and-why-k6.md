# 00 · Performance-testing fundamentals, and why k6

> **Goal:** understand what performance tests are for, the numbers we measure, how to model a workload, and where k6 fits next to tools like JMeter.

## Why performance testing matters

A feature can pass every functional test and still fail in production because it is too slow at peak, falls over under a spike, or slowly runs out of memory. Performance tests answer:

- Do we meet our response-time targets at the **expected peak**?
- **Where does it break**, and how: does it slow down gracefully or start failing?
- Does it **stay healthy over hours**?
- Did the last change make it **slower**?

## Test types

| Type | Question | Shape | In this repo |
|---|---|---|---|
| **Smoke** | Does the script work, and is the system basically healthy? | A few VUs, 1–5 min | `PROFILE=smoke` (also run in CI) |
| **Load** | Do we meet targets at the expected peak? | Ramp to peak, hold 30–60+ min | `PROFILE=load` |
| **Stress** | Where is the limit, and how does it fail? | Increase load step by step past peak | `PROFILE=stress` + `scripts/step_load.py` |
| **Spike** | What happens when load jumps suddenly, and does it recover? | Steady, sudden burst, back to steady | `PROFILE=spike` |
| **Soak** | Is it stable over hours (leaks, build-up)? | Normal load for 4–24 h | `PROFILE=soak` |
| **Breakpoint** | Where exactly does it break? | Keep increasing until it fails | `ramping-arrival-rate` (Tutorial 08) |

## Key metrics

| Metric | Meaning | k6 metric |
|---|---|---|
| **Response time** | Time from sending a request to receiving the whole response | `http_req_duration` |
| **Percentiles** | p95 = 95% of requests were at or below this value | `p(95)` in thresholds and the summary |
| **Throughput** | Requests completed per second | `http_reqs` (count and rate) |
| **Error rate** | Share of failed requests | `http_req_failed` |
| **Concurrency** | Virtual users active at once | `vus`, `vus_max` |
| **Checks** | Share of your assertions that passed | `checks` |

**Use percentiles, not averages.** Ten requests at 100 ms and one at 10 s average about 1 s, which describes nobody. Targets are set on p90/p95, with p99 watched for the tail.

**Apdex** is a 0–1 satisfaction score: (satisfied + tolerating ÷ 2) ÷ total, using a response-time threshold T. k6 doesn't report Apdex out of the box. You can compute it from the results, or use thresholds on percentiles, which is the usual approach in k6.

## SLOs

An SLO is a measurable, agreed target that names the transaction, the percentile, the load and the error budget:

> **Claims Summary report: p95 under 3 s and error rate under 1% at 300 concurrent users.**

That is the target used throughout this repo (the same scenario as the companion JMeter repo). In k6, an SLO becomes a **threshold**, and the test fails (exit code 99) when it is broken.

## Workload modelling

Build the model from data: peak concurrent users, the main transactions, their mix, think time, session length and test data. Ours:

| Transaction | Share | Notes |
|---|---|---|
| Log in | once per session | |
| Open dashboard | 50% | |
| Run Claims Summary | 35% | provider + date range from CSV |
| Export report | 15% | report → start export → poll until ready → download |

Think time 3–8 s, 4 actions per session.

### Little's Law

```
Users (N) = Throughput (X) × (Response time (R) + Think time (Z))
```

300 users, 0.5 s response time, 5.5 s average think time → X = 300 ÷ 6 = **50 actions per second**. Use it to check that your model matches production traffic before you run it.

## Closed and open workload models (important in k6)

- **Closed model:** a fixed number of virtual users loop. A user starts its next request only after the previous one finishes, so **when the system slows down, the load drops**. k6 executors: `constant-vus`, `ramping-vus`, `per-vu-iterations`, `shared-iterations`. (A JMeter Thread Group works the same way.)
- **Open model:** new iterations **arrive at a set rate**, whatever the response times. When the system slows down, work piles up, just like real internet traffic. k6 executors: `constant-arrival-rate`, `ramping-arrival-rate`.

k6 makes the open model a first-class choice. This changes what a stress test shows (Tutorial 14).

## Why k6

| | k6 | JMeter |
|---|---|---|
| Scripts | JavaScript (or TypeScript), plain text, easy to review in Git | XML `.jmx` built mainly in a GUI |
| Engine | Go, one process, very little memory per VU | Java, one thread per virtual user |
| Pass/fail | Thresholds in the script; exit code 99 fails the build | Needs a plugin or a results-check step |
| Load models | Executors, including open-model arrival rates | Thread groups; open models via timers or plugins |
| Protocols | HTTP/1.1, HTTP/2, WebSockets, gRPC; browser module; extensions | Very wide built-in protocol support (JDBC, JMS, LDAP, FTP…) |
| Recording | Grafana k6 Studio (desktop recorder) and HAR conversion | Built-in HTTP(S) Test Script Recorder |
| Results | End-of-test summary, web dashboard HTML report, outputs to Prometheus/OTel/files, Grafana Cloud | HTML dashboard, listeners, Backend Listener |

Neither is "better". k6 suits developer-centric, code-reviewed, CI-first teams. JMeter suits teams that want a GUI, wide protocol coverage or an existing JMeter estate. Knowing both is a strength. Tutorial 15 has a fuller comparison.

## Only test what you own

Load-test only systems you own or have written permission to test. Everything here runs against the **local mock API** in `mock-server/` with synthetic data.

**Next:** [01 · Install k6 and run the mock API](01-install-k6-and-run-the-mock.md)
