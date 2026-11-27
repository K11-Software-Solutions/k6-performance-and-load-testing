# 11 · Scaling out: one machine, many machines, Kubernetes and the cloud

> **Goal:** know how much load one k6 instance can produce, and how to split a test across several machines when you need more.

## One machine goes a long way

k6 is written in Go and runs each VU as a lightweight goroutine with its own JavaScript runtime, not an operating-system thread. One machine can usually run thousands of VUs, depending on the script, the response sizes and the hardware. Before scaling out:

- Watch the load generator's **CPU** (keep it under about 80%) and **memory**.
- Use `SharedArray` for data (Tutorial 04), and don't keep response bodies you don't need (`discardResponseBodies: true` in options, or `responseType: 'none'` per request).
- Avoid `console.log` in VU code during big runs.
- On Linux, raise the open-files limit (`ulimit -n`) for many connections.

## Splitting one test: execution segments

To run one test from several machines without changing the script, give each k6 instance a **segment** of the whole test:

```powershell
# Machine A: the first half
k6 run --execution-segment "0:1/2" --execution-segment-sequence "0,1/2,1" --tag instance=gen-a tests/09-claims-summary-workload.js

# Machine B: the second half (start both at the same time)
k6 run --execution-segment "1/2:1" --execution-segment-sequence "0,1/2,1" --tag instance=gen-b tests/09-claims-summary-workload.js
```

k6 divides VUs, iterations and arrival rates between the segments. With `VUS=4`, each instance runs 2 VUs.

**We tested this locally with k6 v2.4.0:** two instances with `-e VUS=4`, segments `0:1/2` and `1/2:1`. Each reported `vus_max` of 2, and between them they made 75 requests with 0 failures.

What execution segments do **not** do for you:

- **Start the instances together.** Use your own orchestration (a script, CI matrix jobs, Kubernetes).
- **Combine the results.** Each instance prints its own summary and checks its own thresholds. Send all instances' metrics to one place (Prometheus or OpenTelemetry, Tutorial 13) with an `instance` tag to see the whole test. Percentiles from separate summaries **can't** simply be averaged.

This is the big difference from JMeter's distributed mode, where a controller sends the plan to its load generators and collects all the results.

## Kubernetes: the k6 Operator

The **k6 Operator** runs distributed k6 tests on Kubernetes. You put your script in a ConfigMap and create a `TestRun` resource:

```yaml
apiVersion: k6.io/v1alpha1
kind: TestRun
metadata:
  name: claims-summary-load
spec:
  parallelism: 4            # 4 pods, each given an execution segment automatically
  script:
    configMap:
      name: claims-summary-test
      file: 09-claims-summary-workload.js
  arguments: -e PROFILE=load -e VUS=300 -o experimental-prometheus-rw
```

The operator starts the pods together, splits the work with execution segments, and you collect metrics through an output. (Not run in this repo; check the operator's documentation for the current API version.)

## Grafana Cloud k6

`k6 cloud run script.js` runs the test on Grafana's load generators in the regions you choose, and the results land in Grafana Cloud. `k6 cloud run --local-execution script.js` runs locally but streams results to the cloud. Note that k6 v2 needs `k6 cloud login` and a stack for all cloud commands. It's useful when you need a lot of load from several locations. It is a paid service with a free tier; not used in this repo.

## Check yourself

1. Two instances each report p95 = 400 ms and 600 ms. Is the overall p95 500 ms?
2. What does `--execution-segment "1/3:2/3"` mean?

<details><summary>Answers</summary>

1. Not necessarily. Percentiles can't be averaged; you need all the samples (or histograms) in one place.
2. This instance runs the middle third of the test's VUs, iterations or rate.
</details>

**Next:** [12 · CI with GitHub Actions](12-ci-with-github-actions.md)
