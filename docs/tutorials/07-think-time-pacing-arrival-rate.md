# 07 · Think time, pacing and arrival rate

> **Goal:** control how fast virtual users send requests, in three ways, and see the difference.
>
> **Script:** `tests/07-think-time-and-pacing.js` (three 15-second scenarios, one after another)

## A · Think time with `sleep()`

```javascript
getProviders();
sleep(between(1, 3)); // a random 1-3 s, like JMeter's Uniform Random Timer
```

Without think time, a VU sends its next request the instant the last one finishes, and a few VUs can generate as much traffic as hundreds of real users. Random think time also stops VUs moving in lock-step.

Unlike JMeter timers, `sleep()` is just a line of code: it pauses where you put it, and it's included in `iteration_duration` but not in any request's `http_req_duration`.

## B · Pacing

Pacing fixes how often an **iteration starts**, whatever the requests took:

```javascript
const start = Date.now();
getProviders();
http.get(`${BASE_URL}/health`);
const elapsed = (Date.now() - start) / 1000;
sleep(Math.max(0, 2 - elapsed)); // one iteration every 2 s per VU
```

Use it when the target is "N sessions per hour per user". Note that if the requests take longer than the pacing window, the VU falls behind.

## C · Arrival rate: let k6 do it

```javascript
c_arrival_rate: {
  executor: 'constant-arrival-rate',
  rate: 2, timeUnit: '1s', duration: '15s',
  preAllocatedVUs: 2, maxVUs: 10,
}
```

k6 starts **2 iterations every second**, whatever the response times, and uses as many VUs as it needs, up to `maxVUs`. That is the **open model** (Tutorial 00). It's the cleanest way to say "the business expects 2 report runs per second". If k6 runs out of VUs it **drops** iterations and counts them in `dropped_iterations`, which is a sign the system or your `maxVUs` couldn't keep up.

## Run it and compare

```powershell
k6 run tests/07-think-time-and-pacing.js
```

The summary shows one iterations count per scenario. In our run (15 s each):

| Scenario | VUs | Iterations | Why |
|---|---|---|---|
| A think time | 3 | 26 | Each iteration ≈ 2 s average think time + a fast request → about 1.5 per second |
| B pacing | 2 | 16 | One per 2 s per VU → about 15 |
| C arrival rate | up to 10 | 30 | Exactly 2 per second × 15 s |

## Which to use?

| Business target sounds like… | Use |
|---|---|
| "300 users are logged in at peak" | Closed model: VUs + think time (`ramping-vus`) |
| "We get 50 report requests per second at peak" | Open model: `constant-arrival-rate` / `ramping-arrival-rate` |
| "Each user starts a session every minute" | Pacing, or an arrival rate = users ÷ 60 |

**Next:** [08 · Scenarios and executors](08-scenarios-and-executors.md)
