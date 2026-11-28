// Tutorial 04: test data. Each VU logs in as a different synthetic analyst and runs the report
// for a random date range. Data comes from CSV files loaded once into a SharedArray.
// Run:  k6 run tests/04-test-data.js
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { login, claimsSummary } from './lib/api.js';
import { users, dateRanges, randomItem } from './lib/data.js';
import { between } from './lib/config.js';

export const options = {
  vus: 5,
  iterations: 20,
  thresholds: { checks: ['rate==1'] },
};

export default function () {
  // Three common ways to pick a row:
  //  - per VU:         users[(__VU - 1) % users.length]               (same user for the whole test)
  //  - unique per run: users[exec.scenario.iterationInTest % users.length] (each iteration a new row)
  //  - random:         randomItem(users)
  const user = users[exec.scenario.iterationInTest % users.length];
  const range = randomItem(dateRanges);

  const token = login(user.username, user.password);
  if (!token) return;

  const res = claimsSummary(token, user.providerId, range.from, range.to);
  check(res, {
    'report: status 200': (r) => r.status === 200,
    'report: providerId matches the CSV row': (r) => r.json('providerId') === user.providerId,
  });
  sleep(between(1, 2));
}
