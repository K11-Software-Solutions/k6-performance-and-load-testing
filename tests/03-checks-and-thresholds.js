// Tutorial 03: checks verify responses; thresholds turn the results into PASS or FAIL.
// Run:  k6 run tests/03-checks-and-thresholds.js
// Exit code: 0 when every threshold passes, 99 when a threshold fails (so CI can fail the build).
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, authHeaders } from './lib/config.js';
import { login } from './lib/api.js';
import { userForVu, negativeCases } from './lib/data.js';

export const options = {
  vus: 2,
  iterations: 6,
  thresholds: {
    // 95% of all requests faster than 1 s, 99% faster than 2 s
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    // Fewer than 1% failed requests (see responseCallback note below)
    http_req_failed: ['rate<0.01'],
    // At least 99% of checks pass
    checks: ['rate>0.99'],
    // A threshold for one request only, selected by its "name" tag
    'http_req_duration{name:GET /api/reports/claims-summary}': ['p(95)<1500'],
    // Stop the test early if errors get really bad
    'http_req_failed{scenario:default}': [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '5s' }],
  },
};

export default function () {
  const user = userForVu(__VU);
  const token = login(user.username, user.password);
  if (!token) return; // guard: no point continuing without a token

  group('Positive checks', () => {
    const res = http.get(
      `${BASE_URL}/api/reports/claims-summary?providerId=${user.providerId}&from=2026-01-01&to=2026-06-30`,
      { ...authHeaders(token), tags: { name: 'GET /api/reports/claims-summary' } }
    );
    check(res, {
      'report: status 200': (r) => r.status === 200,
      'report: providerId echoed back': (r) => r.json('providerId') === user.providerId,
      'report: under 2 s': (r) => r.timings.duration < 2000,
      'report: body under 20 KB': (r) => r.body.length < 20000,
      // A data-accuracy check: the total must equal the sum of the monthly rows (in cents, to avoid float errors).
      'report: totalPaid = sum of months': (r) => {
        const j = r.json();
        const sum = j.byMonth.reduce((acc, m) => acc + Math.round(m.paid * 100), 0);
        return sum === Math.round(j.totalPaid * 100);
      },
    });
  });

  group('Negative checks (expected errors)', () => {
    for (const c of negativeCases) {
      // responseCallback tells k6 which status codes are NOT failures for this request,
      // so an expected 400/404 does not count in http_req_failed.
      const res = http.get(
        `${BASE_URL}/api/reports/claims-summary?providerId=${c.providerId}&from=${c.from}&to=${c.to}`,
        {
          ...authHeaders(token),
          tags: { name: 'GET claims-summary (negative)' },
          responseCallback: http.expectedStatuses(Number(c.expectedStatus)),
        }
      );
      check(res, { [`negative: ${c.case} returns ${c.expectedStatus}`]: (r) => r.status === Number(c.expectedStatus) });
    }
    const noToken = http.get(`${BASE_URL}/api/dashboard`, {
      tags: { name: 'GET /api/dashboard (no token)' },
      responseCallback: http.expectedStatuses(401),
    });
    check(noToken, { 'security: no token returns 401': (r) => r.status === 401 });
  });

  sleep(1);
}
