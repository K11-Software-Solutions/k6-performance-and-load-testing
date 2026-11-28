// Shared settings. Override any of them on the command line, for example:
//   k6 run -e BASE_URL=http://localhost:3001 tests/09-claims-summary-workload.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

export function authHeaders(token) {
  return { headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` } };
}

// Random think time between min and max seconds (uniform distribution).
export function between(minSeconds, maxSeconds) {
  return minSeconds + Math.random() * (maxSeconds - minSeconds);
}

// Read a number from an environment variable, with a default.
export function envNumber(name, fallback) {
  const v = __ENV[name];
  return v === undefined || v === '' ? fallback : Number(v);
}
