# 12 · CI with GitHub Actions

> **Goal:** run a k6 smoke test on every push and pull request, fail the build when an SLO threshold is broken, and publish the HTML report.
>
> **Workflow:** `.github/workflows/k6-smoke.yml`

## Why k6 fits CI so well

- The script is plain text in the repo, reviewed like code.
- **Thresholds are the gate.** k6 exits with **99** when a threshold fails, and any non-zero exit fails the job. No results-parsing step is needed (JMeter needs one).
- One small binary, quick to install.

## What the workflow does

| Step | What happens |
|---|---|
| Checkout, Node 20 | For the mock API |
| `grafana/setup-k6-action@v1` with `k6-version: 2.4.0` | Installs k6 (pin the version so results are comparable) |
| Start the mock | `node mock-server/server.js` in the background, then wait for `/health` |
| Run the smoke test | `k6 run -e PROFILE=smoke ... tests/09-claims-summary-workload.js` with `K6_WEB_DASHBOARD_EXPORT` set; thresholds decide pass or fail |
| Job summary | The thresholds and results are added to the run's summary page |
| Upload artifact | `k6-report`: the HTML dashboard, the JSON summary and the mock's log (kept 14 days) |

**Run workflow** (workflow_dispatch) lets you change VUs and duration, and tick *run_all* to also run every tutorial script.

```yaml
- name: Install k6
  uses: grafana/setup-k6-action@v1
  with:
    k6-version: "2.4.0"

- name: Run the smoke test (thresholds decide pass/fail)
  env:
    K6_WEB_DASHBOARD: "true"
    K6_WEB_DASHBOARD_EXPORT: results/k6-report.html
  run: k6 run -e PROFILE=smoke --summary-export results/summary.json tests/09-claims-summary-workload.js
```

Grafana also publishes `grafana/run-k6-action`, which runs one or more scripts and can comment on pull requests. The plain `k6 run` step is used here because it's easier to understand and copy into other CI tools.

## Good practice

- **Smoke in CI, real load elsewhere.** GitHub-hosted runners are small shared VMs. Use them to prove the script works and catch big regressions, not to measure capacity.
- **Thresholds for CI are a bit looser** than the production SLO, because shared runners are noisy. Tighten them in a stable, dedicated environment.
- Keep `abortOnFail` thresholds for runaway errors, so a broken deploy fails in seconds instead of minutes.
- Store baseline summaries (`--summary-export`) and compare runs over time.

## Other CI tools

The same three steps work anywhere: install k6 (binary, package or the `grafana/k6` Docker image), start or point at the target, and run `k6 run`. For example, in Azure Pipelines:

```yaml
- script: |
    docker run --rm --network host -v $(Build.SourcesDirectory):/src -w /src grafana/k6:2.4.0 \
      run -e PROFILE=smoke tests/09-claims-summary-workload.js
  displayName: 'k6 smoke test'
```

## Exercise

1. Open a pull request and watch the workflow.
2. On a branch, change the `tx_claims_summary` threshold to `p(95)<10` and push. The job should fail with exit code 99.
3. Download the `k6-report` artifact and open the HTML file.

**Next:** [13 · Live monitoring with Prometheus and Grafana (optional)](13-live-monitoring-prometheus-grafana.md)
