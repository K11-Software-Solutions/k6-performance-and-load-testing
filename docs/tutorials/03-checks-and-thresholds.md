# 03 · Checks and thresholds

> **Goal:** verify each response with **checks**, turn your SLO into pass/fail **thresholds**, and test expected errors without counting them as failures.
>
> **Script:** `tests/03-checks-and-thresholds.js`

## Checks: assertions that don't stop the test

```javascript
check(res, {
  'report: status 200': (r) => r.status === 200,
  'report: providerId echoed back': (r) => r.json('providerId') === user.providerId,
  'report: under 2 s': (r) => r.timings.duration < 2000,
  'report: body under 20 KB': (r) => r.body.length < 20000,
  'report: totalPaid = sum of months': (r) => {
    const j = r.json();
    const sum = j.byMonth.reduce((acc, m) => acc + Math.round(m.paid * 100), 0);
    return sum === Math.round(j.totalPaid * 100);
  },
});
```

- A failed check **doesn't** stop the VU or fail the test by itself. It is recorded in the `checks` metric.
- `check()` returns `true` only if every condition passed, so you can use it as a guard: `if (!check(...)) return;`
- The last check is a **data-accuracy** check. Under load, a report must still be *right*, not just fast. Money is compared in cents to avoid floating-point surprises.

## Thresholds: your SLO as pass/fail

```javascript
thresholds: {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.01'],
  checks: ['rate>0.99'],
  'http_req_duration{name:GET /api/reports/claims-summary}': ['p(95)<1500'],
  'http_req_failed{scenario:default}': [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '5s' }],
},
```

| Threshold | Meaning |
|---|---|
| `p(95)<1000` on `http_req_duration` | 95% of requests faster than 1 s |
| `rate<0.01` on `http_req_failed` | Fewer than 1% failed requests |
| `rate>0.99` on `checks` | At least 99% of checks passed |
| `{name:...}` | A threshold on just the requests with that tag (a sub-metric) |
| `abortOnFail` | Stop the test early when the threshold is crossed, after `delayAbortEval` |

When any threshold fails, k6 prints ✗, logs `thresholds on metrics ... have been crossed`, and **exits with code 99**. CI pipelines fail on a non-zero exit code, so thresholds are a quality gate with no extra tooling. We confirmed exit code 99 with k6 v2.4.0.

Thresholds are set in the script's `options` (there is no `--threshold` command-line flag). To vary them per environment, read a value from `__ENV`.

## Expected errors: `responseCallback`

By default, any 4xx or 5xx response counts as failed in `http_req_failed`. In a negative test the error *is* the correct answer, so tell k6 which statuses are expected:

```javascript
http.get(url, {
  responseCallback: http.expectedStatuses(404),
  tags: { name: 'GET claims-summary (negative)' },
});
```

Plan 03 runs the four cases in `data/negative_cases.csv` (unknown provider → 404, missing provider, bad date format, from after to → 400) and checks that calling `/api/dashboard` with no token returns 401. None of them count as failed requests.

## Run it

```powershell
k6 run tests/03-checks-and-thresholds.js
echo $LASTEXITCODE        # PowerShell: 0 = all thresholds passed
```

To see a failure, change `'p(95)<1000'` to `'p(95)<10'`, run again, and check the exit code is 99.

## Check yourself

1. A check fails 5% of the time but there are no thresholds. Does the test fail?
2. How do you stop an expected 404 counting as a failed request?

<details><summary>Answers</summary>

1. No. Checks only record results. Add a threshold such as `checks: ['rate>0.99']` to make them affect pass/fail.
2. Pass `responseCallback: http.expectedStatuses(404)` with the request (and check the status).
</details>

**Next:** [04 · Test data](04-test-data.md)
