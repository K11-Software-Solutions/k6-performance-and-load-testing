# 01 · Install k6 and run the mock API

> **Goal:** install k6, start the local mock API, and run your first test.
>
> **Script:** `tests/01-hello-k6.js`

## 1. Install k6

The scripts were checked with **k6 v2.4.0**. Any v2.x release should work.

| OS | Command |
|---|---|
| Windows | `winget install k6 --source winget`, or download the `.msi`/`.zip` from <https://github.com/grafana/k6/releases> |
| macOS | `brew install k6` |
| Linux (Debian/Ubuntu) | follow the apt instructions at <https://grafana.com/docs/k6/latest/set-up/install-k6/> |
| Docker | `docker run --rm -i grafana/k6 run - <script.js` |

Check it:

```powershell
k6 version
```

k6 is a single binary. There is no Java and no runtime to install. The scripts are JavaScript, but k6 doesn't use Node.js to run them; it has its own JavaScript engine. (Node.js is only needed here for the mock API.)

> **k6 v2 note.** v2 removed some old commands and flags: `k6 login` (now `k6 cloud login`), `--no-summary` (now `--summary-mode=disabled`), `k6 pause/resume/scale/status` and the `externally-controlled` executor. Older blog posts may still use them.

## 2. Start the mock API

```powershell
node mock-server/server.js
```

You should see `K11 Claims Analytics mock API listening on http://localhost:3000`. Leave it running. Open <http://localhost:3000/portal/login> to see the HTML portal (user `analyst01`, password `learn-jmeter`; the mock is shared with the JMeter repo, hence the name). Every endpoint is listed in [`mock-server/README.md`](../../mock-server/README.md).

## 3. Your first test

```javascript
import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/config.js';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'status is 200': (r) => r.status === 200,
    'service is UP': (r) => r.json('status') === 'UP',
  });
}
```

```powershell
k6 run tests/01-hello-k6.js
```

With no options, k6 runs **1 virtual user for 1 iteration**. The end-of-test summary shows your checks (both ✓) and HTTP metrics such as `http_req_duration` and `http_req_failed`.

Try more load straight from the command line:

```powershell
k6 run --vus 10 --duration 20s tests/01-hello-k6.js
```

## 4. Point at a different host

Every script reads `BASE_URL` from an environment variable passed with `-e`:

```powershell
k6 run -e BASE_URL=http://localhost:3001 tests/01-hello-k6.js
```

## 5. Run every tutorial script

```powershell
python scripts/run_all.py
```

This runs scripts 01–09 (about 4 minutes) and reports PASS/FAIL from each run's exit code.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `connection refused` / `dial tcp ... actively refused` | The mock API isn't running, or it's on another port |
| `k6 is not recognized` | Open a new terminal after installing, or use the full path to `k6.exe` |
| `GoError: open ../../data/users.csv` | Run k6 from the repo root, or check the path; `open()` paths are relative to the script file |

**Next:** [02 · Script anatomy](02-script-anatomy.md)
