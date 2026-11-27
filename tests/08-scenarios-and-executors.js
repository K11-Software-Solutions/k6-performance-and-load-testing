// Tutorial 08: scenarios and executors. Each scenario has its own executor (load shape),
// VUs, timing and function. Here six executors run one after another so you can compare them.
// Run:  k6 run tests/08-scenarios-and-executors.js        (about 70 s)
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { BASE_URL } from './lib/config.js';

export const options = {
  scenarios: {
    // CLOSED models: a number of VUs loop; slower responses = fewer requests
    shared_iterations: {
      executor: 'shared-iterations', // 20 iterations in total, shared by 4 VUs (fast VUs do more)
      vus: 4,
      iterations: 20,
      maxDuration: '10s',
    },
    per_vu_iterations: {
      executor: 'per-vu-iterations', // each of 4 VUs does exactly 5 iterations
      vus: 4,
      iterations: 5,
      maxDuration: '10s',
      startTime: '10s',
    },
    constant_vus: {
      executor: 'constant-vus', // 5 VUs for 10 s
      vus: 5,
      duration: '10s',
      startTime: '20s',
    },
    ramping_vus: {
      executor: 'ramping-vus', // up and down in stages, like a JMeter ramp-up
      startVUs: 0,
      stages: [
        { duration: '5s', target: 8 },
        { duration: '5s', target: 8 },
        { duration: '3s', target: 0 },
      ],
      gracefulRampDown: '2s',
      startTime: '30s',
    },
    // OPEN models: k6 starts iterations at a set rate, whatever the response times
    constant_arrival_rate: {
      executor: 'constant-arrival-rate', // 10 iterations per second for 10 s
      rate: 10,
      timeUnit: '1s',
      duration: '10s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      startTime: '45s',
    },
    ramping_arrival_rate: {
      executor: 'ramping-arrival-rate', // rate goes 2 → 15 → 2 per second
      startRate: 2,
      timeUnit: '1s',
      stages: [
        { duration: '5s', target: 15 },
        { duration: '5s', target: 15 },
        { duration: '3s', target: 2 },
      ],
      preAllocatedVUs: 5,
      maxVUs: 30,
      startTime: '57s',
    },
  },
  thresholds: {
    checks: ['rate==1'],
    // One iterations threshold per scenario makes the summary show each scenario's count
    'iterations{scenario:shared_iterations}': ['count==20'],
    'iterations{scenario:per_vu_iterations}': ['count==20'],
    'iterations{scenario:constant_vus}': ['count>0'],
    'iterations{scenario:ramping_vus}': ['count>0'],
    'iterations{scenario:constant_arrival_rate}': ['count>=95'],
    'iterations{scenario:ramping_arrival_rate}': ['count>0'],
    // If k6 runs out of VUs in an arrival-rate scenario it drops iterations; we want none
    dropped_iterations: ['count==0'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/providers`, { tags: { name: 'GET /api/providers' } });
  check(res, { 'status 200': (r) => r.status === 200 });
  // Closed-model scenarios need think time; arrival-rate scenarios do not.
  if (!exec.scenario.name.includes('arrival')) sleep(0.5);
}
