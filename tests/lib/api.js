import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL, JSON_HEADERS, authHeaders } from './config.js';

// Log in and return the Bearer token, or null if login failed.
export function login(username, password) {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ username, password }), {
    headers: JSON_HEADERS,
    tags: { name: 'POST /api/auth/login' },
  });
  const ok = check(res, {
    'login: status is 200': (r) => r.status === 200,
    'login: token returned': (r) => r.status === 200 && !!r.json('token'),
  });
  return ok ? res.json('token') : null;
}

export function claimsSummary(token, providerId, from, to, name = 'GET /api/reports/claims-summary') {
  const url = `${BASE_URL}/api/reports/claims-summary?providerId=${providerId}&from=${from}&to=${to}`;
  return http.get(url, { ...authHeaders(token), tags: { name } });
}
