# playwright-runner — AI-Optimized Context

> A fluent chainable API wrapper over Playwright for writing declarative UI tests.
> Author: Denis Shelest (<axules@mail.ru>)

---

## Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [API Reference](#-api-reference)
4. [Selector Syntax](#-selector-syntax)
5. [Error System](#-error-system)
6. [Configuration](#-configuration)
7. [Testing](#-testing)
8. [Important Caveats](#-important-caveats)

---

## 📋 Project Overview

**playwright-runner** is a lightweight wrapper around Playwright that provides a **fluent chainable API** for writing UI tests in a declarative style. Each method call represents a single test step; steps are auto-executed as the chain is built.

### Why this project exists

| Problem | Solution |
|---------|----------|
| Playwright's native API is verbose for sequential steps | Fluent interface (method chaining) |
| Managing async execution order is manual | Automatic Promise queue serialization via `this.actionsPull` |
| Unclear assertion error messages | Custom `MatcherError` with colored Expected/Received |
| Screenshot diffing requires boilerplate | Built-in `matchShot` with pixelmatch integration |
| Debugging test steps is cumbersome | Built-in debug logging via `debug: true` option |

### Entry Point

```js
import { PageRunner } from '../src/runner';

PageRunner.create(page)                          // basic usage
  .goto('https://example.com')
  .seeElement('h1');                              // auto-executes the chain

PageRunner.create(page, { debug: true })         // with debug logging
  .goto('https://example.com');
```

### Dependencies

- **Runtime:** `lodash.isstring`, `jpeg-js`, `pixelmatch`
- **Peer:** `@playwright/test` 1.x - x, `playwright` 1.x - x
- **Dev:** Playwright, Jest, Babel (ES modules), eslint + plugins, cross-env

---

## 📁 Project Structure

```
playwright-runner/
├── .gitignore                        # Git ignore rules
├── README.md                         # Project description (RU)
├── eslint.config.js                  # ESLint flat config (v10)
├── babel.config.js                   # Babel config for ES module tests
├── playwright.config.js              # Playwright e2e config
├── jest.config.js                    # Jest unit test config
├── package.json
├── dist/                             # Built output (Babel transpiled)
│   ├── runner.js
│   └── tools/
├── src/
│   ├── runner.js                     # 🔥 CORE: PageRunner class
│   └── tools/
│       ├── createDirDeep.js          # Recursive directory creation
│       ├── diffImages.js             # Screenshot diff via pixelmatch
│       ├── makeExpectedError.js      # Colored error formatting (red/green)
│       ├── MatcherError.js           # Custom assertion error class
│       ├── PageNetworkListener.js    # Network request/response monitoring
│       ├── resolveCssLocator.js      # CSS selector parser with `:@method(arg)` syntax
│       ├── resolveLocator.js         # Shorthand `|>` selector parser
│       ├── RunnerLocator.js          # Programmatic locator builder class
│       ├── screenshotReporter.js     # Legacy Jasmine screenshot reporter
│       ├── ShotMatchError.js         # Screenshot mismatch error
│       ├── takeScreenshot.js         # Screenshot utility with URL overlay
│       ├── utils.js                  # Shared utilities (selectors, styles, attrs, promiseFlow)
│       └── tests/
│           ├── resolveCssLocator.test.js  # Unit tests for resolveCssLocator
│           └── resolveLocator.test.js     # Unit tests for resolveLocator
└── examples/
    ├── google.uitest.js              # Mobile template + geolocation example (raw Playwright)
    └── zapiski.uitest.js             # Fluent API example
```

---

## 🧱 Architecture

### 1. `PageRunner.create(pageOrLocator, config?)` — Entry Point

Static factory method that creates a `PageRunner` instance. If `pageOrLocator` is a Playwright **Page**, it automatically wraps it with `page.locator('html')`.

```js
import { PageRunner } from '../src/runner';
```

The constructor also accepts direct instantiation: `new PageRunner(pageOrLocator, config?)`.

### 2. `PageRunner` — Core Class

**Constructor parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debug` | `boolean` | `false` | Logs each step with timestamp |

**Internal mechanics:**

- **`this.actionsPull`** — A Promise queue. Each method call appends a step via `this._pushAction()`. Steps execute sequentially in FIFO order as the chain is built.
- **`this.locatorsWay`** — A locator stack. `within*` methods push, `withinBack`/`withinInitial` pop. Used for contextual scoping.
- **`this._page`** — Reference to the Playwright `Page` object (extracted from any Locator via `getPage()`).
- **`this.runCallerCounter`** — Debug counter incremented per step, used in log output.
- **`this.log()`** — Debug logger; no-op unless `debug: true` is set in constructor options.
- **`this.init()`** — Initialization method called in constructor; resets state (counters, locator stack, action queue).
- **`_createMatcher()`** — Wrapper around each step: catches errors, augments them with current locator and method name context.
- **`initNetworkListener()`** — Available but **not called automatically** in constructor (commented out). Attach manually via `initNetworkListener(this._page)` if needed.

### 3. `promiseFlow` (from [`src/tools/utils.js`](src/tools/utils.js:124))

An internal utility that executes a list of functions as a sequential Promise chain. This is the backbone of step serialization.

```js
// Executes fn[0], then fn[1], then fn[2]...
promiseFlow([fn1, fn2, fn3]);
```

### 4. PageNetworkListener (from [`src/tools/PageNetworkListener.js`](src/tools/PageNetworkListener.js))

Auto-attached to the page in the `PageRunner` constructor via `initNetworkListener()`. Intercepts network requests via `page.on('request')` / `page.on('requestfinished')` / `page.on('requestfailed')` and stores them for later inspection with `matchRequest` / `matchResponse`. Tracks `activeRequests` count in real-time.

> **Note:** `initNetworkListener()` is **commented out** in the constructor. Attach it manually if you need network request tracking: `initNetworkListener(this._page)`.

---

## 🔧 API Reference

### DOM Navigation

| Method | Description | Implementation |
|--------|-------------|----------------|
| `within(selector)` | Switch context to `page.locator(selector)` | Redirects current locator |
| `withinChild(selector)` | Switch to `currentLocator.locator(selector)` | Nested locator |
| `withinBody()` | Reset to `body` locator | Direct assignment |
| `withinInitial()` | Return to initial locator | Pops entire stack |
| `withinBack(steps?)` | Go back N steps in locator stack | Pop from stack |

### Actions

| Method | Description | Pre-check |
|--------|-------------|-----------|
| `goto(url, waitForSelector?, timeout?)` | Navigate; relative URLs resolve against `page.url()` origin | — |
| `reloadPage(waitForSelector?, timeout?)` | Reload current page | — |
| `click(selector?, options?)` | Click element | — |
| `fill(selector, text, options?)` | Fill input field | — |
| `fillForm(data, parent?)` | Fill form fields by `[name]` attribute | fill + clear |
| `pressKey(key, selector?)` | Press key(s); arrays are chained | — |
| `pressEnter(selector?)` / `pressEsc(selector?)` / `pressTab(selector?)` / `pressSpace(selector?)` | Convenience shortcuts for common keys | — |
| `select(selector, values)` | Select `<option>` values | — |
| `clear(selector?)` | Clear input field | — |
| `focus(selector?)` / `blur(selector?)` | Focus/blur element | — |
| `hover(selector?)` | Hover mouse over element | — |
| `uploadFile(selector, files)` | Upload file(s) | — |
| `scrollIntoViewIfNeeded(selector?, options?)` | Scroll element into view | — |
| `dragTo(selector, target, options?)` | Drag an element to a target element | — |
| `drop(selector, payload, options?)` | Drop data on an element | — |
| `highlight(selector?)` | Highlight an element (Playwright debug feature) | — |
| `highlightOff(selector?)` | Remove highlight from an element | — |

### Assertions

| Method | Description | Playwright Equivalent |
|--------|-------------|----------------------|
| `seeElement(selector?)` | Element is visible | `toBeVisible()` |
| `dontSeeElement(selector?)` | Element is hidden | `toBeHidden()` |
| `expectVisible(selector?)` | Element is visible (explicit) | `toBeVisible()` |
| `expectHidden(selector?)` | Element is hidden (explicit) | `toBeHidden()` |
| `expectText(text, selector?)` | Locator contains text | `toContainText()` |
| `expectExactText(text, selector?)` | Locator has exact text | `toHaveText()` |
| `expectEnabled(selector?)` | Element is enabled | `toBeEnabled()` |
| `expectDisabled(selector?)` | Element is disabled | `toBeDisabled()` |
| `expectValue(selector, value)` | Check input value | `toHaveValue()` |
| `expectStyles(styles, selector?)` | Check CSS styles `({display: 'flex'})` | `toHaveCSS()` |
| `expectAttributes(attr, selector?)` | Check attributes `({href: '/path'})` | `toHaveAttribute()` |
| `expectElementsNumber(count, selector?)` | Check element count | `toHaveCount()` |
| `hasUrl(urlOrPath)` | Check current URL (supports `*`/`**` wildcards) | `toHaveURL()` |
| `hasQueryParams(expectedParams)` | Check URL query params | `toHaveURL()` callback |
| `expectFetch(url, options, expected)` | Fetch and assert response | Custom |

**`hasUrl()` usage:**

```js
// Full URL match
runner.hasUrl('https://example.com/page')

// Relative path with wildcard
runner.hasUrl('*/path')         // same origin + /path
runner.hasUrl('**/page')        // any URL ending with /page
```

### Screenshots

| Method | Description |
|--------|-------------|
| `saveShot(selector, name)` | Save element screenshot (both params required) |
| `savePageShot(name)` | Save full page screenshot |
| `matchShot(selector?, name, saveCurrent?)` | Compare with reference; saves if missing or `updateShot: true` |

### Network

| Method | Description |
|--------|-------------|
| `waitForRequest({minCount?, timeout?})` | Wait until active requests <= minCount |
| `listenNetwork()` | Start recording requests/responses (clears previous history) |
| `stopListenNetwork()` | Stop recording |
| `matchRequest(url, matcher, timeout?)` | Find request by URL pattern and assert |
| `matchResponse(url, matcher, timeout?)` | Find response by URL pattern and assert |

### Utilities

| Method | Description |
|--------|-------------|
| `waitTime(ms?)` | Pause (default: 500ms) |
| `pause()` | Playwright `page.pause()` (debug panel) |
| `say(text)` | `console.log` during chain execution |
| `sayWhere()` | Log current locator |
| `sayFullPath()` | Log entire locator stack |
| `act(func)` | Execute arbitrary user function as a step (receives `{runner, page}`) |
| `then(onFulfilled?, onRejected?)` | Thenable interface; enables `await` on the runner instance directly |
| `waitForRequestAfterTrigger(triggerFn, checkRequest)` | Trigger an action and wait for a specific network request |
| `waitForFunction(callback)` | Wait for a function to return a truthy value (`page.waitForFunction`) |

### Fetch / API

| Method | Description |
|--------|-------------|
| `fetch(url, options?)` | Make an HTTP request relative to current page origin |
| `expectFetch(url, options, expected)` | Fetch and assert response status/data |

### Getters

| Getter | Returns |
|--------|---------|
| `runner.currentLocator` | Current Playwright `Locator` |
| `runner.currentPage` | Playwright `Page` |
| `runner.currentUrl` | `new URL(page.url())` |
| `runner.find(selector?)` | Resolved locator (current or child via `resolveCssLocator`) |
| `runner.apiContext` | Playwright `page.request` (APIRequestContext) |

---

## 🔍 Selector Syntax

### resolveCssLocator (`:@method(arg)` syntax)

File: [`src/tools/resolveCssLocator.js`](src/tools/resolveCssLocator.js)

The `resolveCssLocator` function parses a CSS selector string with custom `:@method(arg)` directives into Playwright locator method calls. This allows more readable selectors with inline text, role, label, placeholder, and title matching.

### Exported functions

| Function | Purpose |
|----------|---------|
| `parseCssSelector(selector)` | Split CSS selector by `:@method(arg)` directives |
| `resolveCustomMethod(customMethod)` | Resolve a single `:@method(arg)` into a `[method, ...args]` tuple |
| `resolveCssQuery(value)` | Parse full value into array of `[method, ...args]` tuples |
| `resolveCssLocator(parent, selector)` | Resolve a CSS selector string against a parent locator |

### Custom CSS Syntax Table

| Shorthand | Resolves To | Example |
|-----------|-------------|---------|
| `div:@text(Submit)` | `locator('div').filter({ hasText: 'Submit' })` | Filter by text (no node) |
| `*:@text(Submit)` | `getByText('Submit')` | Find child by text (with node) |
| `div:@role(button)` | `locator('div').getByRole('button')` | Match by ARIA role |
| `form:@label(email)` | `locator('form').getByLabel('email')` | Match by label |
| `input:@placeholder(Enter name)` | `locator('input').getByPlaceholder('Enter name')` | Match by placeholder |
| `a:@title(Click here)` | `locator('a').getByTitle('Click here')` | Match by title |
| `div:@text("Submit (123)")` | `locator('div').filter({ hasText: 'Submit (123)' })` | Quoted arg with parentheses |
| `div >*:@text(Content)` | `locator('div').getByText('Content')` | Node prefix `>*` for `getByText` |
| `li:@at(index)` | `locator('li').nth(index)` | Select nth element by index (zero-based) |
| `li:@first()` | `locator('li').first()` | Select the first element |
| `li:@last()` | `locator('li').last()` | Select the last element |

### resolveLocator (`|>` shorthand syntax)

File: [`src/tools/resolveLocator.js`](src/tools/resolveLocator.js)

The `resolveLocator` function parses a shorthand string into Playwright locator method calls. This allows more readable selectors without calling Playwright APIs directly.

### Exported functions

| Function | Purpose |
|----------|---------|
| `resolveLocator(parent, selector)` | Resolve a shorthand selector string against a parent locator |
| `resolveQuery(value)` | Split by `|>` and resolve each piece into an array of `[method, ...args]` |
| `resolveQueryPiece(locatorPiece)` | Resolve a single shorthand piece |
| `resolveText(text)` | Convert wildcard text to RegExp if contains `*` |

### Syntax Table

| Shorthand | Resolves To | Example |
|-----------|-------------|---------|
| `button` | `locator('button')` | CSS/tag selector (default) |
| `:"Текст"` | `getByText('Текст')` | Exact text match |
| `:"*текст*"` | `getByText(/текст/i)` | Case-insensitive substring |
| `"Текст"` | `filter({ hasText: 'Текст' })` | (alias, without colon) |
| `:button"Кнопка"` | `getByRole('button', { name: 'Кнопка' })` | Role + accessible name |
| `:button"*кнопк*"` | `getByRole('button', { name: /кнопк/i })` | Role + regex name |
| `:~метка` | `getByLabel('метка')` | By `aria-label` or associated `<label>` |
| `:~*метк*` | `getByLabel(/метк/i)` | Label with regex |

### Chaining with `|>`

Separator for chaining multiple queries on the same locator:

```
`div.form |> :button"Сохранить"` 
// 1. locator('div.form') 
// 2. .getByRole('button', { name: 'Сохранить' })
```

### Wildcard `*` Behavior

In text/role/label queries, `*` is converted to a regex (`.*`) with case-insensitive flag. Example: `"*hello*"` → `/^.*hello.*$/i`.

---

## ⚠️ Error System

### Error Hierarchy

| Error Class | File | When Thrown | Properties |
|-------------|------|-------------|------------|
| `MatcherError` | [`src/tools/MatcherError.js`](src/tools/MatcherError.js) | Any assertion failure | `message` (formatted with green/red colors), `received`, `expected` |
| `ShotMatchError` | [`src/tools/ShotMatchError.js`](src/tools/ShotMatchError.js) | Screenshot mismatch | `diffName`, `diffResult`, `diffCount` |

### Error Enrichment

Every step in the chain wraps its execution in `_createMatcher()`. If an error occurs, it's enriched with:
- Current locator string
- Method name that failed
- Any available context (selector, expected values)

This means errors bubble up with full context, making debugging easier without manual `try/catch`.

### Helper functions (from [`src/tools/makeExpectedError.js`](src/tools/makeExpectedError.js))

| Function | Description |
|----------|-------------|
| `toRedText(text)` | Wrap text in ANSI red |
| `toGreenText(text)` | Wrap text in ANSI green |
| `makeExpectedError(received, expected)` | Format `Expected: green / Received: red` string |

---

## ⚙️ Configuration

### [`playwright.config.js`](playwright.config.js) — Key Settings

| Setting | Value |
|---------|-------|
| `testDir` | `'./examples'` |
| `testMatch` | `'*.uitest.js'` |
| Timeout (global) | 5s |
| `waitUntil` | `'load'` |
| `preserveOutput` | `'failures-only'` |
| `repeatEach` | 1 |
| `fullyParallel` | `true` |
| `forbidOnly` | `!!process.env.CI` |
| `retries` | `process.env.CI ? 2 : 0` |
| `headless` | `false` (default) |
| `viewport` | `1500x1000` |
| `timezoneId` | `'UTC'` |
| `screenshot` | `'only-on-failure'` |
| `trace` | `'on-first-retry'` |
| `ignoreHTTPSErrors` | `true` |
| Browser | chromium only (via `projects`) |
| Reporter | `html` (never open) + `list` (with `printSteps`) |
| `expect.toHaveScreenshot.maxDiffPixels` | 10 |
| `expect.toMatchSnapshot.maxDiffPixelRatio` | 0.1 |
| `expect.timeout` | 5000 |

### [`jest.config.js`](jest.config.js) — Key Settings

| Setting | Value |
|---------|-------|
| `testMatch` | `'**/src/**/*.test.js'` |
| `testEnvironment` | `'node'` |
| `clearMocks` | `true` |
| `coverageReporters` | `['text', 'lcov']` |

### [`package.json`](package.json) — Key Scripts & Fields

| Field | Value |
|-------|-------|
| `version` | `1.0.9` |
| `main` | `'./dist/runner.js'` |
| `exports` | `'.' / './runner' → './dist/runner.js'`; `'./tools/*' → './dist/tools/*'` |
| `files` | `['dist', 'src']` |

| Script | Command |
|--------|---------|
| `test` | `jest` |
| `example` | `npx playwright test` |
| `report` | `npx playwright show-report` |
| `build` | `babel --delete-dir-on-start -d dist src --ignore **/*.test.js` |

---

## 🧪 Testing

### Commands

| Command | What it runs | File pattern |
|---------|-------------|--------------|
| `npm test` | Jest unit tests | `src/**/*.test.js` |
| `npm run example` | E2E tests | `examples/*.uitest.js` |
| `npm run report` | Open Playwright HTML report | — |
| `npm run build` | Babel transpile src → dist | `src/` (excl. `*.test.js`) |
| `cross-env NODE_MODE=update npx playwright test` | Update reference screenshots | `examples/*.uitest.js` |

> **Note:** On Windows use `cross-env NODE_MODE=update npx playwright test` or `set NODE_MODE=update && npx playwright test` for environment variables.

### Current unit tests

- [`src/tools/tests/resolveCssLocator.test.js`](src/tools/tests/resolveCssLocator.test.js) — Tests for CSS `:@method(arg)` selector parsing (`parseCssSelector`, `resolveCustomMethod`, `resolveCssQuery`, `resolveCssLocator`)
- [`src/tools/tests/resolveLocator.test.js`](src/tools/tests/resolveLocator.test.js) — Tests for shorthand `|>` selector parsing (`resolveQuery`, `resolveQueryPiece`, `resolveText`)

---

## 📌 Important Caveats

1. **`page.networkListener`** — This property is NOT auto-attached by the `PageRunner` constructor (the line is commented out). Attach manually if needed: `initNetworkListener(this._page)`.

2. **_getTarget / _getTargets** — These internal methods use `selectElement` / `selectElements` from [`src/tools/utils.js`](src/tools/utils.js). They support:
   - XPath (prefix `/`)
   - CSS selectors
   - Arrays of `[selector, index]` for nth-element selection

3. **_wait / _waitPromise / _waitTarget** — Internal methods for flexible waiting. `_wait` dispatches based on argument type (number → timeout, function → promise polling, string/locator → element visibility).

4. **`matchShot` behavior** — Screenshots are saved if:
   - No reference file exists
   - `updateShot: true` (or `NODE_MODE=update` is set)
   - `saveCurrent` parameter is `true`
   
   Otherwise, they are compared using `diffImages` (pixelmatch), and a `ShotMatchError` is thrown on mismatch.
   > **Note:** `updateShot` and `screenshotTool` constructor options are **commented out** in the `init()` method. They are still referenced in `matchShot`/`saveShot` methods.

5. **`resolveLocator` chaining** — The `|>` separator creates a chain of locator queries. Each segment is resolved independently and applied sequentially on the parent locator.

6. **`hasQueryParams` is implemented** — The method uses `toHaveURL()` callback to validate query parameters. No longer throws.

7. **Negated assertion helpers removed** — `_disabled.not`, `_checked.not`, and `_has.not` no longer exist. Use `expectDisabled`, `dontSeeElement`, or standard Playwright assertions instead.

8. **`fillForm` uses `fill` + `clear`** — This method calls `fill(String(value))` or `clear()` per field (not triple-click). For array/function values, it supports dynamic value resolution per field index.

9. **Coding conventions:**
    - Variables/functions: `camelCase`
    - Classes: `PascalCase`
    - Imports: ES modules (`import`/`export`)
    - Linting: ESLint flat config v10 via `eslint-presets`

---

## 🎯 Complete Examples

### Basic test with assertions ([`examples/zapiski.uitest.js`](examples/zapiski.uitest.js))

```js
import {test} from '@playwright/test';

import {PageRunner} from '../src/runner';


test('Check login and registration forms', async ({page}) => {
  await PageRunner.create(page, {debug: true})
    .goto('https://zapiski.online')
    .within('.cookiesNotification')
    .expectText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
    .within('#login_frame')
    .expectText('Войти')
    .click('li:@text(Регистрация)')
    .expectText('Повторите пароль')
    .sayWhere()
    .sayFullPath()
    .expectFetch('/json/m_authf/aj_get_info', {}, {status: 200})
    .act(async ({page}) => {
      await page.setViewportSize({width: 640, height: 640});
    });
});
```

### Mobile & geolocation test ([`examples/google.uitest.js`](examples/google.uitest.js))

This example uses **raw Playwright API** (not the runner) to demonstrate mobile device emulation with geolocation:

```js
import {
  devices,
  test,
} from '@playwright/test';


test.use({
  ...devices['iPhone 13 Pro'],
  locale: 'en-US',
  geolocation: { longitude: 12.492507, latitude: 41.889938 },
  permissions: ['geolocation'],
});

test('Mobile and geolocation', async ({ page }) => {
  await page.goto('https://maps.google.com');
  await page.getByText('Your location').click();
  await page.waitForRequest(/.*preview\/pwa/);
  await page.screenshot({ path: 'colosseum-iphone.png' });
});
```

### Custom screenshot tool + matchShot

```js
import { test } from '@playwright/test';
import { PageRunner } from '../src/runner';
import { screenshotTool } from '../src/tools/takeScreenshot';

test('match screenshot', async ({ page }) => {
  await PageRunner.create(page, {
    screenshotTool: screenshotTool('screenshots/my-test')
  })
    .goto('https://example.com')
    .matchShot('h1', 'main-heading');
});
```

### Network request/response inspection

```js
await PageRunner.create(page)
  .goto('https://example.com')
  .listenNetwork()
  .click('"Отправить"')
  .matchResponse('/api/submit', async (response) => {
    const data = await response.json();
    expect(data.status).toBe('ok');
  })
  .stopListenNetwork();
```
