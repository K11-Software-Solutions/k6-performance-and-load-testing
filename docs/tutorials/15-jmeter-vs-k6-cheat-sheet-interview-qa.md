# 15 · JMeter vs k6, cheat sheet and interview Q&A

## JMeter and k6, concept by concept

| Concept | JMeter | k6 |
|---|---|---|
| Test script | `.jmx` XML, built in the GUI | `.js` (or `.ts`) code |
| Virtual user | Thread | VU (goroutine + JS runtime) |
| Load shape | Thread Group (users, ramp-up, duration) | Scenario + executor (`ramping-vus`, `constant-arrival-rate`, …) |
| Open model | Throughput timers, Open Model Thread Group | `constant-arrival-rate`, `ramping-arrival-rate` |
| Request | HTTP Request sampler | `http.get/post/...` |
| Defaults, headers, cookies | HTTP Request Defaults, Header Manager, Cookie Manager | Variables/helpers, a params object, automatic cookie jar |
| Test data | CSV Data Set Config | `SharedArray` + `open()` |
| Correlation | JSON / Regex / Boundary extractors | `res.json()`, `parseHTML`, regex, `findBetween` |
| Assertion | Response / JSON / Duration assertions | `check()` |
| Pass/fail gate | Plugin or a results-check script | **Thresholds** (exit code 99) |
| Think time | Timers | `sleep()` |
| Transaction | Transaction Controller | `group()` and custom Trends |
| Logic | Logic controllers | JavaScript `if`, `for`, `while` |
| Custom code | JSR223 + Groovy | The script *is* code |
| setUp / tearDown | setUp / tearDown Thread Group | `setup()` / `teardown()` |
| Shared value across users | Property (`props.put`) | Return it from `setup()` |
| Run headless | `jmeter -n -t … -l …` | `k6 run script.js` (always headless) |
| HTML report | `-e -o report` | `K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT=report.html` |
| Raw results | `.jtl` | `--out csv=…`, `--out json=…` |
| Live monitoring | Backend Listener → InfluxDB/Graphite | `-o experimental-prometheus-rw`, `-o opentelemetry` |
| Distributed | Controller + `jmeter-server` over RMI; results combined | Execution segments, k6 Operator, Grafana Cloud k6; combine via an output |
| Recording | HTTP(S) Test Script Recorder | Grafana k6 Studio, HAR conversion |

**When to pick which:** k6 for code-first, CI-first teams testing HTTP APIs and microservices. JMeter for GUI-led teams, wide protocol coverage (JDBC, JMS, LDAP and so on) or an existing JMeter estate. Saying "I'd use either, and here's why for this case" is a strong interview answer.

## Cheat sheet

```powershell
k6 run script.js                                   # run with the script's options
k6 run --vus 10 --duration 30s script.js           # override load
k6 run -e PROFILE=load -e VUS=50 script.js         # pass environment variables (__ENV)
k6 run --summary-export summary.json script.js     # summary as JSON
k6 run --out csv=results.csv script.js             # every sample to CSV
k6 run --summary-mode=full script.js               # detailed summary (v2)
k6 run --http-debug=full script.js                 # print requests and responses
k6 run --execution-segment "0:1/2" --execution-segment-sequence "0,1/2,1" script.js
k6 inspect script.js                               # show the resolved options
k6 new script.js                                   # create a starter script
$env:K6_WEB_DASHBOARD="true"; $env:K6_WEB_DASHBOARD_EXPORT="report.html"   # HTML report (PowerShell)
```

```javascript
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import exec from 'k6/execution';

export const options = {
  scenarios: { load: { executor: 'ramping-vus', stages: [{ duration: '1m', target: 50 }, { duration: '5m', target: 50 }] } },
  thresholds: { http_req_duration: ['p(95)<3000'], http_req_failed: ['rate<0.01'], checks: ['rate>0.99'] },
};
```

| Built-in metric | Meaning |
|---|---|
| `http_req_duration` | Response time |
| `http_req_failed` | Failed request rate |
| `http_reqs` | Request count and throughput |
| `checks` | Check pass rate |
| `iterations`, `iteration_duration` | Iterations and their duration |
| `vus`, `vus_max` | Active and allocated VUs |
| `dropped_iterations` | Arrivals not started (open model) |
| `http_req_waiting` | Time to first byte |

**Little's Law:** Users = Throughput × (Response time + Think time). For an arrival rate: VUs needed ≈ rate × iteration duration.

---

## Interview Q&A

**1. What is k6 and how is it different from JMeter?**
An open-source load-testing tool from Grafana Labs. Tests are JavaScript, it runs as one efficient Go binary, and thresholds give a built-in pass/fail. JMeter is Java and GUI-based, uses a thread per user and has wider protocol support. I'd choose based on the team, the protocols and CI needs.

**2. Explain the k6 test life cycle.**
Init code (imports, options, files) once per VU; `setup()` once; the default function looped by every VU (one loop = one iteration); `teardown()` once at the end.

**3. Checks versus thresholds?**
Checks assert on individual responses and record a pass rate, but don't fail the test. Thresholds are pass/fail criteria on metrics, such as `p(95)<3000`; crossing one makes k6 exit with 99.

**4. How do you fail a CI build on an SLO breach?**
Put the SLO in `thresholds`. k6 exits non-zero (99) when one fails, which fails the job. Add `abortOnFail` for runaway errors.

**5. What are executors? Give an open and a closed one.**
They define the load shape. Closed: `constant-vus`, `ramping-vus` (a fixed number of users who wait for responses). Open: `constant-arrival-rate`, `ramping-arrival-rate` (iterations start at a set rate whatever the response times).

**6. When would you use an arrival-rate executor?**
When the target is a rate ("50 report requests per second"), or in stress tests where you want load to keep arriving when the system slows down, as real traffic does.

**7. What are `dropped_iterations`?**
Arrivals k6 couldn't start because all `maxVUs` were busy. Either the system is too slow to keep up, or `maxVUs` is too low. Either way, the test didn't deliver the planned load.

**8. How do you parameterise data efficiently?**
`SharedArray` with `open()` in the init code, so the file is loaded once and shared between VUs. Pick rows by VU, by `exec.scenario.iterationInTest`, or at random.

**9. How do you correlate a token?**
`const token = res.json('token')`, then send it in the `Authorization` header of later requests. For HTML use `parseHTML(...).find(...).attr(...)` or a regex. Cookies are handled automatically per VU.

**10. Why set a `name` tag on requests?**
Dynamic URLs (with IDs) would otherwise create a separate metric series per URL. A fixed `name` groups them and makes per-endpoint thresholds possible.

**11. How do you test that an endpoint correctly returns 404 without counting it as a failure?**
`responseCallback: http.expectedStatuses(404)` on the request, plus a check on the status.

**12. How do you measure a business transaction made of several requests?**
Wrap it in `group()` (which gives `group_duration`), or time it and add it to a custom `Trend`, as plan 09 does with `tx_claims_summary`.

**13. How do you share data from setup with VUs?**
Return it from `setup()`; it arrives as the argument of the default function (read-only).

**14. How do you run a large distributed k6 test?**
Execution segments across machines, the k6 Operator on Kubernetes (a `TestRun` with `parallelism`), or Grafana Cloud k6. Send every instance's metrics to one backend, because percentiles from separate summaries can't be averaged.

**15. How do you get an HTML report?**
`K6_WEB_DASHBOARD=true` and `K6_WEB_DASHBOARD_EXPORT=report.html`, or write your own with `handleSummary`.

**16. Throughput flattens while response time climbs. What does it mean?**
Saturation: requests are queuing for a limited resource. Confirm with server metrics (pools, CPU, database) and state the capacity where the SLO breaks.

**17. In an open-model stress test, errors appear just past the limit and keep growing during the run. Why is that different from a closed model?**
With a fixed arrival rate, every second brings more work than the system can finish, so the queue grows until requests time out. In our lab, 20% over the limit gave a failed rate that climbed from 0 to about 10% within 90 s. In a closed model, waiting users stop sending, so the queue can't grow beyond the number of users. That's why closed-model tests can show the same bottleneck with fewer or no errors. (Tutorial 14 shows both.)

**18. How do you avoid cascade errors in a script?**
Guard dependent steps: if login or report creation fails, stop that iteration (`if (!token) return;`). Otherwise one failure creates many follow-up errors and inflates the error rate.

**19. What did you learn from comparing JMeter and k6 on the same system?** *(your own words, after doing the exercises)*
For example: the same capacity ceiling appears in both, but the error pattern depends on the workload model, and thresholds make k6 much simpler in CI.

**20. How do you keep k6 results comparable between runs?**
Same environment, data, script version, k6 version and profile; a warm-up; tag each run with a `testid`; keep baseline summaries.

**Previous:** [14 · Reading results and finding bottlenecks](14-reading-results-and-finding-bottlenecks.md) · **Back to the [learning path](../../README.md#learning-path)**
