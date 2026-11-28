// Tutorial 06: organise results with groups and tags, and measure business events with custom metrics.
// Run:  k6 run tests/06-groups-tags-custom-metrics.js
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { BASE_URL, authHeaders } from './lib/config.js';
import { login, claimsSummary } from './lib/api.js';
import { userForVu, randomItem, dateRanges } from './lib/data.js';

// Custom metrics are created in the init context.
const exportReadyTime = new Trend('export_ready_time', true); // true = values are times (ms)
const exportPolls = new Counter('export_polls');
const reportsWithClaims = new Rate('reports_with_claims');
const lastTotalPaid = new Gauge('last_total_paid');

export const options = {
  vus: 3,
  iterations: 9,
  tags: { test: 'tutorial-06' }, // a tag added to every metric in this test
  thresholds: {
    checks: ['rate==1'],
    export_ready_time: ['p(95)<5000'], // thresholds work on custom metrics too
    reports_with_claims: ['rate==1'],
    // Thresholds on a group: the built-in group_duration metric, filtered by the group tag
    'group_duration{group:::Export report}': ['p(95)<6000'],
  },
};

export default function () {
  const user = userForVu(__VU);
  const token = login(user.username, user.password);
  if (!token) return;

  let reportId;
  group('Run report', () => {
    const range = randomItem(dateRanges);
    const res = claimsSummary(token, user.providerId, range.from, range.to);
    check(res, { 'report: 200': (r) => r.status === 200 });
    reportId = res.json('reportId');
    reportsWithClaims.add(res.json('totalClaims') > 0);
    lastTotalPaid.add(res.json('totalPaid'));
  });

  group('Export report', () => {
    const start = Date.now();
    const exp = http.post(`${BASE_URL}/api/reports/claims-summary/export`, JSON.stringify({ reportId }), {
      ...authHeaders(token),
      tags: { name: 'POST /api/reports/claims-summary/export' },
    });
    let status = exp.json('status');
    const exportId = exp.json('exportId');
    let polls = 0;
    while (status !== 'READY' && polls < 10) {
      sleep(0.5);
      const s = http.get(`${BASE_URL}/api/reports/exports/${exportId}`, {
        ...authHeaders(token),
        tags: { name: 'GET /api/reports/exports/{exportId}' },
      });
      status = s.json('status');
      polls++;
    }
    exportPolls.add(polls);
    if (status === 'READY') exportReadyTime.add(Date.now() - start);
    check(status, { 'export: ready within 10 polls': (s) => s === 'READY' });
  });

  sleep(1);
}
