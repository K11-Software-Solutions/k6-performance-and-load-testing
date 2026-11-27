import { SharedArray } from 'k6/data';

// A tiny CSV reader for simple files (no quoted commas). For real-world CSV files use the
// papaparse library from jslib.k6.io, or k6's CSV module; both are shown in Tutorial 04.
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const header = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => (row[h] = cells[i] === undefined ? '' : cells[i]));
    return row;
  });
}

// SharedArray loads the file ONCE and shares one read-only copy between all VUs.
// open() is only allowed in the init context, and paths are relative to THIS file.
export const users = new SharedArray('users', () => parseCsv(open('../../data/users.csv')));
export const dateRanges = new SharedArray('date ranges', () => parseCsv(open('../../data/date_ranges.csv')));
export const negativeCases = new SharedArray('negative cases', () => parseCsv(open('../../data/negative_cases.csv')));

// A different user for each VU (wraps round when there are more VUs than rows).
export function userForVu(vuId) {
  return users[(vuId - 1) % users.length];
}

export function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
