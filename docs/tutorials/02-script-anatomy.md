# 02 · Script anatomy

> **Goal:** understand the four parts of a k6 script (init, setup, default, teardown), what a VU and an iteration are, and how options are set.
>
> **Script:** `tests/02-script-anatomy.js`

## The life cycle

| Stage | Runs | Use it for | Can make HTTP requests? |
|---|---|---|---|
| **init code** (top level) | Once per VU, before the test | `import`, `options`, loading files with `open()`, creating custom metrics | No |
| **`setup()`** | Once, before VUs start | Checking the system is up, creating test data, getting a shared token | Yes |
| **`default` function** (VU code) | Again and again, by every VU | The user journey. One run = one **iteration** | Yes |
| **`teardown(data)`** | Once, after VUs finish | Cleaning up test data, logging | Yes |

Whatever `setup()` returns is passed to `default(data)` and `teardown(data)` as a read-only copy.

## VUs and iterations

- A **virtual user (VU)** is an independent JavaScript runtime that runs the default function in a loop. It has its own variables and its own cookie jar.
- An **iteration** is one complete run of the default function.
- Each VU's code runs in sequence. Parallelism comes from having many VUs.

Useful built-ins: `__VU` (this VU's number, starting at 1), `__ITER` (this VU's iteration number, starting at 0), and the `k6/execution` module for more detail (scenario name, iteration in the whole test, and so on).

## Options

Options can be set in four places. Later ones win:

1. Defaults
2. `export const options = { ... }` in the script
3. Environment variables, for example `K6_VUS=10`
4. Command-line flags, for example `--vus 10 --duration 30s`

```javascript
export const options = {
  vus: 3,
  duration: '15s',
};
```

`vus` + `duration` is a shortcut for one `constant-vus` scenario. For anything more realistic you use **scenarios** (Tutorial 08).

## Groups and sleep

```javascript
group('Browse reference data', () => {
  const res = http.get(`${BASE_URL}/api/providers`);
  check(res, { 'providers: status 200': (r) => r.status === 200 });
});
sleep(between(1, 2)); // think time: a random 1-2 s
```

- `group()` organises the summary and gives you `group_duration` per group, much like a JMeter Transaction Controller.
- `sleep()` pauses the VU, which is how you add think time (Tutorial 07).

## Run it

```powershell
k6 run tests/02-script-anatomy.js
k6 run --vus 5 --duration 20s tests/02-script-anatomy.js
```

Watch the summary: `iterations`, `vus`, `group_duration`, and the `teardown` log line at the end.

## Check yourself

1. Why can't you make an HTTP request in the init code?
2. 3 VUs, 15 s, about 1.5 s per iteration: roughly how many iterations?

<details><summary>Answers</summary>

1. Init code runs once per VU just to set the VU up (and once more to read the options), so k6 doesn't allow network calls there. Use `setup()`.
2. Each VU does about 15 ÷ 1.5 = 10, so about 30 in total.
</details>

**Next:** [03 · Checks and thresholds](03-checks-and-thresholds.md)
