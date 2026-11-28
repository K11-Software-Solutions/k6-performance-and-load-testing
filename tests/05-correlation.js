// Tutorial 05: correlation. Capture dynamic values from one response and send them in the next request.
//  - CSRF token from HTML: with k6/html (CSS selector) and with a regular expression
//  - Session cookie: handled automatically by each VU's cookie jar
//  - Bearer token, a random provider, reportId and exportId: from JSON with res.json()
// Run:  k6 run tests/05-correlation.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { parseHTML } from 'k6/html';
import { BASE_URL, JSON_HEADERS, authHeaders } from './lib/config.js';
import { userForVu } from './lib/data.js';

export const options = {
  vus: 2,
  iterations: 6,
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'] },
};

export default function () {
  const user = userForVu(__VU);

  group('HTML login with a CSRF token', () => {
    const page = http.get(`${BASE_URL}/portal/login`, { tags: { name: 'GET /portal/login' } });

    // Way 1: parse the HTML and use a CSS selector
    const csrf = parseHTML(page.body).find('input[name=_csrf]').attr('value');
    // Way 2: a regular expression (works on any text)
    const m = /name="_csrf" value="([^"]+)"/.exec(page.body);
    const csrfRegex = m ? m[1] : null;
    check(csrf, { 'csrf found (HTML parser)': (v) => !!v, 'both ways agree': (v) => v === csrfRegex });

    // The SESSION cookie set by the login page is sent back automatically.
    const res = http.post(
      `${BASE_URL}/portal/login`,
      { username: user.username, password: user.password, _csrf: csrf }, // an object = form-encoded body
      { tags: { name: 'POST /portal/login' } }
    );
    check(res, {
      'signed in (followed the redirect to home)': (r) => r.status === 200 && r.body.includes('Welcome,'),
    });
  });

  group('API journey with JSON values', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/login`,
      JSON.stringify({ username: user.username, password: user.password }),
      { headers: JSON_HEADERS, tags: { name: 'POST /api/auth/login' } }
    );
    const token = loginRes.json('token');

    const providers = http.get(`${BASE_URL}/api/providers`, { tags: { name: 'GET /api/providers' } });
    const ids = providers.json('providers.#.providerId'); // GJSON path: every providerId as an array
    const providerId = ids[Math.floor(Math.random() * ids.length)];

    const report = http.get(
      `${BASE_URL}/api/reports/claims-summary?providerId=${providerId}&from=2026-01-01&to=2026-03-31`,
      { ...authHeaders(token), tags: { name: 'GET /api/reports/claims-summary' } }
    );
    const reportId = report.json('reportId');

    const exp = http.post(`${BASE_URL}/api/reports/claims-summary/export`, JSON.stringify({ reportId, format: 'CSV' }), {
      ...authHeaders(token),
      tags: { name: 'POST /api/reports/claims-summary/export' },
    });
    const exportId = exp.json('exportId');

    // The exportId is part of the URL, so give the request a fixed name tag.
    // Otherwise every unique URL becomes its own row in the results.
    const status = http.get(`${BASE_URL}/api/reports/exports/${exportId}`, {
      ...authHeaders(token),
      tags: { name: 'GET /api/reports/exports/{exportId}' },
    });

    check(null, {
      'token captured': () => !!token,
      'random provider picked': () => /^P\d{4}$/.test(providerId),
      'reportId captured': () => /^rpt-/.test(reportId),
      'export accepted (202)': () => exp.status === 202,
      'exportId captured': () => /^exp-/.test(exportId),
      'export status readable': () => status.status === 200,
    });
  });

  sleep(1);
}
