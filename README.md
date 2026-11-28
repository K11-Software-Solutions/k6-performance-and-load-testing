<p align="center">
  <img src="docs/images/k11_logo.png" alt="K11 Software Solutions" width="120">
</p>

<h1 align="center">k6 Performance and Load Testing: Beginner to Advanced</h1>

<p align="center">
  A hands-on learning path from K11 Tech Lab for <a href="https://grafana.com/docs/k6/latest/">Grafana k6</a>: fundamentals, 15 numbered tutorials with runnable scripts, a safe local mock API, CI with GitHub Actions, and a worked bottleneck example with real data.
  <br>Companion to <a href="https://github.com/K11-Software-Solutions/jmeter-performance-and-load-testing">jmeter-performance-and-load-testing</a>: same mock API, same scenario, so you can compare the tools on the same system.
</p>

<p align="center">
  <a href="docs/k6_Performance_Testing_Guide.pdf"><b>📘 Download the PDF guide</b></a> ·
  <a href="#learning-path">Learning path</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="docs/tutorials/15-jmeter-vs-k6-cheat-sheet-interview-qa.md">JMeter vs k6 and interview Q&amp;A</a>
</p>

---

## What's inside

| Folder | Contents |
|---|---|
| [`docs/tutorials/`](docs/tutorials/) | 16 Markdown tutorials (00–15) with hands-on steps and self-checks |
| [`tests/`](tests/) | Runnable k6 scripts, one or more per tutorial, plus shared helpers in `tests/lib/` |
| [`data/`](data/) | Synthetic CSV test data (users, date ranges, negative cases) |
| [`mock-server/`](mock-server/) | A local, dependency-free Node.js API to test against, with a built-in connection-pool bottleneck |
| [`scripts/`](scripts/) | Python helpers: run every tutorial script, run an open-model step (stress) test, draw the chart |
| [`results/sample/`](results/sample/) | A real step-test result set from the mock, used in the worked example |
| [`observability/`](observability/) | Optional Prometheus + Grafana stack for live results |
| [`.github/workflows/`](.github/workflows/) | k6 smoke test on every push and PR; thresholds are the gate; HTML report as an artifact |
| [`docs/k6_Performance_Testing_Guide.pdf`](docs/k6_Performance_Testing_Guide.pdf) | The whole path as a designed PDF guide |

> **Safe by design.** Every script targets the local mock API in `mock-server/`, never a real website. Only load-test systems you own or have written permission to test.

## Quick start

You need **k6 v2** (checked with v2.4.0), **Node.js 18+** (for the mock only) and **Python 3.8+** (for the helpers). See [Tutorial 01](docs/tutorials/01-install-k6-and-run-the-mock.md).

```powershell
# 1. Start the mock API (leave it running)
node mock-server/server.js

# 2. In a second terminal: run the smoke test with an HTML report
$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="results/report.html"
k6 run tests/09-claims-summary-workload.js

# 3. Or run every tutorial script (exit code 0 = all thresholds passed)
python scripts/run_all.py
```

## Learning path

| # | Tutorial | Script | You will learn |
|---|---|---|---|
| **Part 1 · Fundamentals** ||||
| 00 | [Fundamentals and why k6](docs/tutorials/00-fundamentals-and-why-k6.md) | – | Test types, percentiles, SLOs, workload models, Little's Law, open vs closed models, k6 vs JMeter |
| **Part 2 · k6 basics** ||||
| 01 | [Install k6 and run the mock API](docs/tutorials/01-install-k6-and-run-the-mock.md) | `01-hello-k6.js` | Install, first run, k6 v2 notes |
| 02 | [Script anatomy](docs/tutorials/02-script-anatomy.md) | `02-script-anatomy.js` | init / setup / default / teardown, VUs, iterations, options |
| 03 | [Checks and thresholds](docs/tutorials/03-checks-and-thresholds.md) | `03-checks-and-thresholds.js` | Assertions, SLO thresholds, exit code 99, expected errors |
| 04 | [Test data](docs/tutorials/04-test-data.md) | `04-test-data.js` | SharedArray, CSV, unique data per iteration |
| 05 | [Correlation](docs/tutorials/05-correlation.md) | `05-correlation.js` | JSON, HTML and regex extraction, cookies, URL grouping |
| 06 | [Groups, tags and custom metrics](docs/tutorials/06-groups-tags-custom-metrics.md) | `06-groups-tags-custom-metrics.js` | Transactions, tag filters, Trend/Counter/Rate/Gauge |
| **Part 3 · Advanced k6** ||||
| 07 | [Think time, pacing and arrival rate](docs/tutorials/07-think-time-pacing-arrival-rate.md) | `07-think-time-and-pacing.js` | Closed vs open pacing in practice |
| 08 | [Scenarios and executors](docs/tutorials/08-scenarios-and-executors.md) | `08-scenarios-and-executors.js` | All six executors side by side |
| 09 | [The Claims Summary workload model](docs/tutorials/09-claims-summary-workload.md) | `09-claims-summary-workload.js` | The full model; smoke, load, stress, spike and soak profiles |
| 10 | [Results and reports](docs/tutorials/10-results-and-reports.md) | – | The summary, web dashboard HTML report, outputs, `handleSummary` |
| 11 | [Scaling out](docs/tutorials/11-scaling-out.md) | – | Execution segments, k6 Operator, Grafana Cloud k6 |
| 12 | [CI with GitHub Actions](docs/tutorials/12-ci-with-github-actions.md) | `.github/workflows/k6-smoke.yml` | Thresholds as the build gate |
| 13 | [Live monitoring: Prometheus and Grafana](docs/tutorials/13-live-monitoring-prometheus-grafana.md) *(optional)* | `observability/` | Remote write, OpenTelemetry, dashboards |
| **Part 4 · Results** ||||
| 14 | [Reading results and finding bottlenecks](docs/tutorials/14-reading-results-and-finding-bottlenecks.md) | `scripts/step_load.py` | An open-model stress test with real data, compared with JMeter |
| **Part 5 · Reference** ||||
| 15 | [JMeter vs k6, cheat sheet and interview Q&A](docs/tutorials/15-jmeter-vs-k6-cheat-sheet-interview-qa.md) | – | Concept map, commands, 20 interview questions |

## The scenario

A **healthcare claims analytics** application. Analysts log in, open a dashboard, run the **Claims Summary** report for a provider and date range, and export it.

> **SLO: Claims Summary p95 under 3 s and error rate under 1% at 300 concurrent users.**
> Mix: Dashboard 50%, Claims Summary 35%, Export 15%; think time 3–8 s.

## How the scripts were checked

Every script from 01 to 09 was run with **k6 v2.4.0** (Windows 11) against the mock API, and every threshold passed (`python scripts/run_all.py`). Also checked with real runs: the threshold-failure exit code (99), the web dashboard HTML export, JSON/CSV outputs, `--summary-export`, and splitting a test across two instances with execution segments. Not run: the Prometheus/Grafana Docker stack and the k6 Operator example.

## About

Created by **Kavita Jadhav**, Founder & CEO of [K11 Software Solutions](https://github.com/K11-Software-Solutions) (K11 Tech Lab).
