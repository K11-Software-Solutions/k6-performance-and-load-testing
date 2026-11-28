// Tutorial 01: the smallest useful k6 test. One virtual user calls GET /health once and checks the answer.
// Run:  k6 run tests/01-hello-k6.js
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
