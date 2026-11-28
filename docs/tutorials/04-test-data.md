# 04 · Test data

> **Goal:** feed each virtual user different data from CSV files, efficiently, so the test behaves like many real users rather than one user many times.
>
> **Script:** `tests/04-test-data.js` · **Helpers:** `tests/lib/data.js` · **Data:** `data/*.csv`

## Why

If every VU logs in as the same user and asks for the same report, caches flatter the results, you exercise one path through the data, and session rules may reject parallel logins.

## Load data once with SharedArray

```javascript
import { SharedArray } from 'k6/data';

export const users = new SharedArray('users', () => parseCsv(open('../../data/users.csv')));
```

- `open()` reads a file. It only works in **init code**, and the path is relative to the script file that calls it.
- Each VU runs the init code, so a plain array would be loaded once **per VU**: 1,000 VUs means 1,000 copies in memory. `SharedArray` loads the data **once** and shares a read-only copy. Use it for any data file bigger than a few rows.
- `parseCsv` in `tests/lib/data.js` is a tiny reader for simple files. For real CSV files (quoted values, commas inside fields) use one of these:

  ```javascript
  // papaparse from jslib (downloaded when the test starts, so it needs internet access)
  import papaparse from 'https://jslib.k6.io/papaparse/5.1.1/index.js';
  const users = new SharedArray('users', () => papaparse.parse(open('./users.csv'), { header: true }).data);
  ```

  ```javascript
  // k6's built-in CSV module (still experimental in v2.4.0; we checked it works)
  import { open } from 'k6/experimental/fs';
  import csv from 'k6/experimental/csv';
  const file = await open('./users.csv');
  const users = await csv.parse(file, { asObjects: true });
  ```

  The repo uses its own small parser so the scripts have no dependencies and nothing experimental.

## Picking a row

| Strategy | Code | Use when |
|---|---|---|
| One user per VU | `users[(__VU - 1) % users.length]` | Each VU keeps one identity for the whole test |
| A new row every iteration | `users[exec.scenario.iterationInTest % users.length]` | Each session should be a different user (plan 04 and plan 09) |
| Random | `randomItem(users)` | Order doesn't matter (date ranges) |

`exec.scenario.iterationInTest` is unique across all VUs in the scenario, so no two iterations get the same row until the file wraps round. When you split a test across several k6 instances (Tutorial 11), check that the instances don't reuse the same rows. For example, give each instance its own data file.

## Other ways to make data

- Generate it: `` `analyst${String(__VU).padStart(2, '0')}` ``, random dates, or UUIDs with the global `crypto.randomUUID()`.
- Fetch it in `setup()`, for example a list of valid IDs from the API, and pass it to the VUs.
- Read JSON: `new SharedArray('x', () => JSON.parse(open('./data.json')))`.

## Healthcare note

Never put real PHI or production credentials in a data file. The files here are synthetic. In a real project use synthetic or approved masked data, and keep it out of logs and reports.

## Run it

```powershell
k6 run tests/04-test-data.js
```

The check `report: providerId matches the CSV row` proves each request used its own row.

**Next:** [05 · Correlation](05-correlation.md)
