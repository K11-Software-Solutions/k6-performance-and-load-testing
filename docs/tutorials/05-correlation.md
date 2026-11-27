# 05 · Correlation

> **Goal:** capture dynamic values the server generates and send them in later requests: a CSRF token from HTML, a session cookie, a Bearer token and IDs from JSON.
>
> **Script:** `tests/05-correlation.js`

## The idea

Servers create values per session or per request: tokens, CSRF values, session cookies, record IDs. A script that replays old values fails, or quietly gets error pages. **Correlation** means: find the dynamic value → extract it → reuse it.

In k6 this is ordinary JavaScript: the response is an object, and you keep values in variables.

## From JSON: `res.json()`

```javascript
const token = loginRes.json('token');                          // a field
const ids = providers.json('providers.#.providerId');          // every providerId as an array
const providerId = ids[Math.floor(Math.random() * ids.length)]; // pick one at random
const reportId = report.json('reportId');
```

`res.json(selector)` uses **GJSON** paths: `a.b`, `items.0.id`, `items.#` (count), `items.#.id` (all ids). With no selector, `res.json()` parses the whole body into a JavaScript object.

## From HTML: `k6/html`

```javascript
import { parseHTML } from 'k6/html';
const csrf = parseHTML(page.body).find('input[name=_csrf]').attr('value');
```

`parseHTML` gives you jQuery-like CSS selectors.

## Anything else: a regular expression

```javascript
const m = /name="_csrf" value="([^"]+)"/.exec(page.body);
const csrfRegex = m ? m[1] : null;
```

The same pattern as a JMeter Regular Expression Extractor. jslib also has a `findBetween(text, left, right)` helper, like JMeter's Boundary Extractor.

## Cookies: automatic

Each VU has its own **cookie jar**. The `SESSION` cookie from `GET /portal/login` is stored and sent back with the `POST /portal/login` automatically, like JMeter's Cookie Manager. For manual control use `http.cookieJar()`. Redirects are followed automatically (up to 10 by default; `maxRedirects` changes it).

## Form posts

Pass an object as the body and k6 sends it form-encoded:

```javascript
http.post(`${BASE_URL}/portal/login`, { username, password, _csrf: csrf });
```

For JSON, pass `JSON.stringify(...)` and a `Content-Type: application/json` header.

## Name your dynamic URLs

```javascript
http.get(`${BASE_URL}/api/reports/exports/${exportId}`, {
  tags: { name: 'GET /api/reports/exports/{exportId}' },
});
```

Without the `name` tag, each unique URL becomes its own entry in the metrics, which bloats outputs and makes thresholds by URL useless. This is called **URL grouping**. (`http.url` tagged templates do the same thing automatically.)

## Debugging

- `console.log(JSON.stringify(res.json(), null, 2))` to see a response
- `k6 run --http-debug=full tests/05-correlation.js` prints every request and response with bodies (use 1 VU)
- Guard each step: if a value is missing, `return` instead of sending a broken request (plan 09 does this)

## Run it

```powershell
k6 run tests/05-correlation.js
```

All checks should pass, including `both ways agree`: the HTML parser and the regex extracted the same CSRF token.

**Next:** [06 · Groups, tags and custom metrics](06-groups-tags-custom-metrics.md)
