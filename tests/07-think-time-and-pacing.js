// Tutorial 07: three ways to control how fast virtual users send requests.
//   A  think time:  sleep() a random 1-3 s between actions (closed model, like a JMeter timer)
//   B  pacing:      start one iteration every 2 s per VU, however long the requests took
//   C  arrival rate: let k6 start 2 iterations per second (open model; no sleep needed)
// The three scenarios run one after another (startTime). Compare their iteration rates.
// Run:  k6 run tests/07-think-time-and-pacing.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, between } from './lib/config.js';

const PHASE = __ENV.PHASE_SECONDS || '15';

export const options = {
  scenarios: {
    a_think_time: {
      executor: 'constant-vus',
      vus: 3,
      duration: `${PHASE}s`,
      exec: 'thinkTime',
    },
    b_pacing: {
      executor: 'constant-vus',
      vus: 2,
      duration: `${PHASE}s`,
      startTime: `${PHASE}s`,
      exec: 'pacing',
    },
    c_arrival_rate: {
      executor: 'constant-arrival-rate',
      rate: 2, // 2 iterations...
      timeUnit: '1s', // ...per second
      duration: `${PHASE}s`,
      preAllocatedVUs: 2,
      maxVUs: 10,
      startTime: `${2 * Number(PHASE)}s`,
      exec: 'arrivalRate',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    // Iterations per scenario, visible in the summary
    'iterations{scenario:a_think_time}': ['count>0'],
    'iterations{scenario:b_pacing}': ['count>0'],
    'iterations{scenario:c_arrival_rate}': ['count>0'],
  },
};

function getProviders() {
  const res = http.get(`${BASE_URL}/api/providers`, { tags: { name: 'GET /api/providers' } });
  check(res, { 'status 200': (r) => r.status === 200 });
}

export function thinkTime() {
  getProviders();
  sleep(between(1, 3)); // uniform random think time, like JMeter's Uniform Random Timer
}

export function pacing() {
  const start = Date.now();
  getProviders();
  http.get(`${BASE_URL}/health`, { tags: { name: 'GET /health' } });
  const elapsed = (Date.now() - start) / 1000;
  sleep(Math.max(0, 2 - elapsed)); // wait out the rest of the 2 s pacing window
}

export function arrivalRate() {
  getProviders(); // no sleep: the executor decides when each iteration starts
}
