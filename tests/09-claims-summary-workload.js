// Tutorial 09 onward: the full Claims Summary workload model (the same one as the JMeter repo).
// Analysts log in, then open the dashboard (50%), run the Claims Summary report (35%) or export it (15%),
// with 3-8 s think time. PROFILE picks the load shape; every number can be overridden with -e.
//
//   k6 run tests/09-claims-summary-workload.js                         (smoke: 5 VUs, 1 min)
//   k6 run -e PROFILE=load tests/09-claims-summary-workload.js         (300 VUs, 10 min ramp, 1 h)
//   k6 run -e PROFILE=stress -e RATE=40 tests/09-claims-summary-workload.js
//   k6 run -e PROFILE=spike tests/09-claims-summary-workload.js
//   k6 run -e PROFILE=soak tests/09-claims-summary-workload.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { BASE_URL, authHeaders, between, envNumber } from './lib/config.js';
import { login, claimsSummary } from './lib/api.js';
import { users, dateRanges, randomItem } from './lib/data.js';

const PROFILE = (__ENV.PROFILE || 'smoke').toLowerCase();
const THINK_MIN = envNumber('THINK_MIN', 3); // seconds
const THINK_MAX = envNumber('THINK_MAX', 8);
const ACTIONS = envNumber('ACTIONS_PER_SESSION', 4);
const MIX_DASHBOARD = envNumber('MIX_DASHBOARD', 50);
const MIX_CLAIMS = envNumber('MIX_CLAIMS', 35); // export = the rest (15)

// One Trend per business transaction, like JMeter Transaction Controllers.
const tx = {
  login: new Trend('tx_login', true),
  dashboard: new Trend('tx_dashboard', true),
  claims: new Trend('tx_claims_summary', true),
  export: new Trend('tx_export_report', true),
};

const PROFILES = {
  // Closed model (VUs), like a JMeter Thread Group
  smoke: { executor: 'constant-vus', vus: envNumber('VUS', 5), duration: __ENV.DURATION || '1m' },
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: __ENV.RAMP || '10m', target: envNumber('VUS', 300) },
      { duration: __ENV.DURATION || '1h', target: envNumber('VUS', 300) },
      { duration: '1m', target: 0 },
    ],
  },
  soak: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: envNumber('VUS', 20) },
      { duration: __ENV.DURATION || '4h', target: envNumber('VUS', 20) },
      { duration: '1m', target: 0 },
    ],
  },
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '10s', target: envNumber('VUS', 10) },
      { duration: '50s', target: envNumber('VUS', 10) },
      { duration: '5s', target: envNumber('SPIKE_VUS', 70) }, // sudden jump
      { duration: '60s', target: envNumber('SPIKE_VUS', 70) },
      { duration: '10s', target: envNumber('VUS', 10) }, // back to normal: does it recover?
      { duration: '60s', target: envNumber('VUS', 10) },
    ],
  },
  // Open model: k6 starts RATE new sessions per second whatever the response times
  stress: {
    executor: 'constant-arrival-rate',
    rate: envNumber('RATE', 10),
    timeUnit: '1s',
    duration: __ENV.DURATION || '90s',
    preAllocatedVUs: envNumber('PRE_VUS', 50),
    maxVUs: envNumber('MAX_VUS', 500),
  },
};

if (!PROFILES[PROFILE]) throw new Error(`Unknown PROFILE "${PROFILE}". Use smoke, load, stress, spike or soak.`);

export const options = {
  scenarios: { [PROFILE]: { ...PROFILES[PROFILE], gracefulStop: '30s' } },
  thresholds: {
    // The SLO from the workload model: Claims Summary p95 under 3 s, errors under 1%
    tx_claims_summary: ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    // Also show the other transactions in the summary
    tx_login: ['p(95)<3000'],
    tx_dashboard: ['p(95)<3000'],
    tx_export_report: ['p(95)<10000'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

// In the stress (open) profile one iteration is one action, so the arrival rate is the action rate.
const OPEN = PROFILE === 'stress';

export default function () {
  // One iteration = one user session (closed profiles): log in, then ACTIONS weighted actions with think time.
  const user = users[exec.scenario.iterationInTest % users.length];
  const t0 = Date.now();
  const token = login(user.username, user.password);
  tx.login.add(Date.now() - t0);
  if (!token) return; // guard: a user whose login failed stops here (no cascade of 401 errors)

  const actions = OPEN ? 1 : ACTIONS;
  for (let i = 0; i < actions; i++) {
    const r = Math.random() * 100;
    if (r < MIX_DASHBOARD) dashboard(token);
    else if (r < MIX_DASHBOARD + MIX_CLAIMS) claims(token, user);
    else exportReport(token, user);
    if (!OPEN) sleep(between(THINK_MIN, THINK_MAX));
  }
}

function dashboard(token) {
  group('TX02 Dashboard', () => {
    const t0 = Date.now();
    const res = http.get(`${BASE_URL}/api/dashboard`, { ...authHeaders(token), tags: { name: 'GET /api/dashboard' } });
    tx.dashboard.add(Date.now() - t0);
    check(res, { 'dashboard: 200': (r) => r.status === 200 });
  });
}

function claims(token, user) {
  group('TX03 Claims Summary', () => {
    const range = randomItem(dateRanges);
    const t0 = Date.now();
    const res = claimsSummary(token, user.providerId, range.from, range.to);
    tx.claims.add(Date.now() - t0);
    check(res, {
      'claims: 200': (r) => r.status === 200,
      'claims: has totalPaid': (r) => r.status === 200 && r.json('totalPaid') !== undefined,
    });
  });
}

function exportReport(token, user) {
  group('TX04 Export Report', () => {
    const t0 = Date.now();
    const range = randomItem(dateRanges);
    const report = claimsSummary(token, user.providerId, range.from, range.to, 'GET /api/reports/claims-summary (before export)');
    if (!check(report, { 'export: report 200': (r) => r.status === 200 })) return; // guard

    const exp = http.post(
      `${BASE_URL}/api/reports/claims-summary/export`,
      JSON.stringify({ reportId: report.json('reportId') }),
      { ...authHeaders(token), tags: { name: 'POST /api/reports/claims-summary/export' } }
    );
    if (!check(exp, { 'export: accepted 202': (r) => r.status === 202 })) return; // guard

    const exportId = exp.json('exportId');
    let status = exp.json('status');
    for (let polls = 0; status !== 'READY' && polls < 10; polls++) {
      sleep(0.5);
      const s = http.get(`${BASE_URL}/api/reports/exports/${exportId}`, {
        ...authHeaders(token),
        tags: { name: 'GET /api/reports/exports/{exportId}' },
      });
      if (s.status !== 200) break;
      status = s.json('status');
    }
    if (status === 'READY') {
      const dl = http.get(`${BASE_URL}/api/reports/exports/${exportId}/download`, {
        ...authHeaders(token),
        tags: { name: 'GET /api/reports/exports/{exportId}/download' },
      });
      check(dl, { 'export: CSV downloaded': (r) => r.status === 200 && r.body.startsWith('month,claims,paid') });
    }
    tx.export.add(Date.now() - t0);
  });
}
