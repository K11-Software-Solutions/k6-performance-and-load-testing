# 06 · Groups, tags and custom metrics

> **Goal:** organise results by business transaction, filter metrics with tags, and measure things k6 doesn't measure for you.
>
> **Script:** `tests/06-groups-tags-custom-metrics.js`

## Groups

```javascript
group('Export report', () => { /* report, export, polls */ });
```

Groups nest steps in the summary and produce `group_duration{group:::Export report}`: the time the whole group took, like a JMeter Transaction Controller. You can put a threshold on it:

```javascript
'group_duration{group:::Export report}': ['p(95)<6000'],
```

(The `::` prefix marks the root group; nested groups add more `::` separators.)

## Tags

Every metric sample carries **tags**, and thresholds and outputs can filter on them.

| Tag | Where it comes from |
|---|---|
| `name`, `url`, `method`, `status` | Each HTTP request (set `name` yourself for dynamic URLs) |
| `group`, `scenario` | The group and scenario the sample came from |
| `expected_response` | Whether the status counted as success (see `responseCallback`) |
| Your own | `tags` in request params, in `options.tags` (whole test), or `--tag key=value` on the command line |

```javascript
export const options = { tags: { test: 'tutorial-06' } };
```

## Custom metrics

| Type | Records | Example in plan 06 |
|---|---|---|
| **Trend** | Values, with avg/min/max/percentiles | `export_ready_time`: from starting an export to READY |
| **Counter** | A running total | `export_polls`: how many status polls in total |
| **Rate** | The share of true values | `reports_with_claims`: reports with at least one claim |
| **Gauge** | The latest value | `last_total_paid` |

```javascript
import { Trend } from 'k6/metrics';
const exportReadyTime = new Trend('export_ready_time', true); // true = it's a time
// ...
exportReadyTime.add(Date.now() - start);
```

Create metrics in init code. Thresholds work on them like any built-in metric:

```javascript
thresholds: { export_ready_time: ['p(95)<5000'], reports_with_claims: ['rate==1'] },
```

Plan 09 uses one Trend per business transaction (`tx_login`, `tx_dashboard`, `tx_claims_summary`, `tx_export_report`), so the summary reads like a JMeter Aggregate Report by transaction.

## Run it

```powershell
k6 run tests/06-groups-tags-custom-metrics.js
```

In the summary find `export_ready_time` (about 1.5–2 s: the mock takes about 1.5 s to prepare an export) and `export_polls`.

**Next:** [07 · Think time, pacing and arrival rate](07-think-time-pacing-arrival-rate.md)
