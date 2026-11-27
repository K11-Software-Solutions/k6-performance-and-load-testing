// Tutorial 02: the four parts of every k6 script, in the order k6 runs them.
// Run:  k6 run tests/02-script-anatomy.js
//       k6 run --vus 5 --duration 20s tests/02-script-anatomy.js     (CLI flags override options)
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, JSON_HEADERS, between } from './lib/config.js';

// 1. INIT CODE: runs once per VU before the test (and once more to read options).
//    Load files and define options here. You cannot make HTTP requests here.
export const options = {
  vus: 3, // virtual users running the default function in parallel
  duration: '15s', // how long to keep them running
  // iterations: 30,  // alternatively: a total number of iterations shared by all VUs
};

// 2. SETUP: runs ONCE before the VUs start. Whatever it returns is passed to default() and teardown().
export function setup() {
  const res = http.get(`${BASE_URL}/health`);
  if (res.status !== 200) {
    throw new Error(`Mock API is not running at ${BASE_URL} (status ${res.status})`);
  }
  return { startedAt: new Date().toISOString() };
}

// 3. DEFAULT FUNCTION (the VU code): each VU runs it again and again until the test ends.
//    One run of this function is one ITERATION.
export default function (data) {
  group('Browse reference data', () => {
    const res = http.get(`${BASE_URL}/api/providers`, { headers: JSON_HEADERS });
    check(res, {
      'providers: status 200': (r) => r.status === 200,
      'providers: 20 returned': (r) => r.json('count') === 20,
    });
  });
  sleep(between(1, 2)); // think time: 1-2 s
}

// 4. TEARDOWN: runs ONCE after all VUs finish.
export function teardown(data) {
  console.log(`Test started at ${data.startedAt} has finished.`);
}
