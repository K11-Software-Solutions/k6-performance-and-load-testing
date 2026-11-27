# 13 · Live monitoring with Prometheus and Grafana (optional)

> **Goal:** stream k6 metrics into Prometheus while a long test runs, and watch them in Grafana next to your server metrics.
>
> **Stack:** `observability/docker-compose.yml`
>
> **Status:** we checked that k6 v2.4.0 accepts the `experimental-prometheus-rw` output (with nothing listening it logs connection errors and the test still runs). The Docker stack and the starter Grafana dashboard were **not** run while building this repo, because Docker was not running on the build machine. Treat them as a starting point.

## Why

The end-of-test summary and HTML report arrive at the end. In a 4-hour soak, or a test the whole team is watching, you want live graphs, ideally on the same Grafana as the application's CPU, memory and database metrics, so cause and effect are side by side.

## Which output?

| Output | Flag | Notes |
|---|---|---|
| Prometheus remote write | `-o experimental-prometheus-rw` | Used here. Still labelled experimental but widely used |
| OpenTelemetry | `-o opentelemetry` | What k6 now recommends for metrics output; works with any OTel collector |
| InfluxDB v1 | `-o influxdb=http://host:8086/k6` | **Deprecated**: in v2.4.0 it prints "planned for removal in k6 v3" |
| JSON / CSV | `-o json=…` / `-o csv=…` | Files, not live |
| Grafana Cloud k6 | `k6 cloud run --local-execution` | Hosted, paid with a free tier |

## Start the stack

```powershell
docker compose -f observability/docker-compose.yml up -d
```

- Prometheus at <http://localhost:9090>, started with `--web.enable-remote-write-receiver` so k6 can push to it
- Grafana at <http://localhost:3030>, with the *Prometheus-k6* data source and the *K11 k6 live results* dashboard pre-loaded (admin `admin` / `admin`, local use only)

## Run a test with the output

```powershell
$env:K6_PROMETHEUS_RW_SERVER_URL="http://localhost:9090/api/v1/write"
$env:K6_PROMETHEUS_RW_TREND_STATS="p(95),p(99),avg,max"
k6 run -o experimental-prometheus-rw -e PROFILE=load -e VUS=20 -e RAMP=30s -e DURATION=5m tests/09-claims-summary-workload.js
```

`K6_PROMETHEUS_RW_TREND_STATS` chooses which statistics are sent for Trend metrics. They appear as metrics such as `k6_http_req_duration_p95`. Other metric names include `k6_http_reqs_total`, `k6_vus` and `k6_http_req_failed_rate`.

The starter dashboard has four panels: virtual users, requests per second, p95 by request name, and failed-request rate. Grafana also publishes official k6 dashboards for Prometheus on grafana.com. Search for "k6 Prometheus" and import the one that matches your setup.

## Tag your runs

Add `--tag testid=claims-load-2026-11-27` (or the CI run number) so you can pick out one run in Grafana and compare runs.

## Stop and clean up

```powershell
docker compose -f observability/docker-compose.yml down
```

**Next:** [14 · Reading results and finding bottlenecks](14-reading-results-and-finding-bottlenecks.md)
