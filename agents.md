# playwright-runner — AI-Optimized Context

> A fluent chainable API wrapper over Playwright for writing declarative UI tests.
> Author: Denis Shelest (<axules@mail.ru>)

---

## Table of Contents

1. [Project Overview](#-project-overview)
2. [Architecture](#-architecture)
3. [API Reference](#-api-reference)
4. [Selector Syntax (resolveLocator)](#-selector-syntax-resolvelocator)
5. [Error System](#-error-system)
6. [Configuration](#-configuration)
7. [Testing](#-testing)
8. [Important Caveats](#-important-caveats)

---

## 📋 Project Overview

**playwright-runner** is a lightweight wrapper around Playwright that provides a **fluent chainable API** for writing UI tests in a declarative style. Each method call represents a single test step; steps are serialized into a Promise queue and executed only when `.run()` is called.

### Why this project exists

| Problem | Solution |
|---------|----------|
| Playwright's native API is verbose for sequential steps | Fluent interface (method chaining) |
| Managing async execution order is manual | Automatic Promise queue serialization via `this.pull` |
| Unclear assertion error messages | Custom `MatcherError` with colored Expected/Received |
| Screenshot diffing requires boilerplate | Built-in `matchShot` with pixelmatch integration |
| Debugging test steps is cumbersome | Built-in debug logging via `debug: true` option |

### Entry Point

```js
import { PageRunner } from '../src/runner';

PageRunner.create(page)                          // basic usage
  .goto('https://example.com')
  .see('h1')
  .run();                                        // required — executes the chain

PageRunner.create(page, { debug: true })         // with debug logging
  .goto('https://example.com')
  .run();
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
│       ├── resolveLocator.js         # Shorthand selector parser
│       ├── screenshotReporter.js     # Legacy Jasmine screenshot reporter
│       ├── ShotMatchError.js         # Screenshot mismatch error
│       ├── takeScreenshot.js         # Screenshot utility with URL overlay
│       ├── utils.js                  # Shared utilities (selectors, styles, attrs)
│       └── tests/
│           └── resolveLocator.test.js    # Unit test for resolveLocator
└── examples/
    ├── google.uitest.js              # Mobile template + geolocation example (raw Playwright)
    └── zapiski.uitest.js             # Fluent API example
```

---

## 🧱 Architecture

### 1. `PageRunner.create(pageOrLocator, config?)` — Entry Point

Static factory method that creates a `PageRunner` instance. If `pageOrLocator` is a Playwright **Page**, it automatically wraps it with `page.locator('body')`.

```js
import { PageRunner } from '../src/runner';
```

The constructor also accepts direct instantiation: `new PageRunner(pageOrLocator, config?)`.

### 2. `PageRunner` — Core Class

**Constructor parameters:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debug` | `boolean` | `false` | Logs each step with timestamp |
| `updateShot` | `boolean` | `false` | Screenshot update mode — overridden by `NODE_MODE=update` env |
| `screenshotTool` | `function` | `defaultScreenshotMaster` | Custom screenshot function (see [`takeScreenshot.js`](src/tools/takeScreenshot.js)) |
| `targetTimeout` | `number` | `2500` | Timeout for element visibility (ms) |

**Internal mechanics:**

- **`this.pull`** — A Promise queue. Each method call appends a step via `this._then()`. Steps execute sequentially in FIFO order when `.run()` is called.
- **`this.locatorsWay`** — A locator stack. `moveTo*` methods push, `moveBack`/`moveToInitial` pop. Used for contextual scoping.
- **`this.page`** — Reference to the Playwright `Page` object (extracted from any Locator via `getPage()`).
- **`this.runCallerCounter`** — Debug counter incremented per step, used in log output.
- **`this._disabled.not` / `this._checked.not` / `this._has.not`** — Negated assertion helpers set up during `init()`.
- **`_createMatcher()`** — Wrapper around each step: catches errors, augments them with current locator and method name context.
- **`initNetworkListener()`** — Called in constructor; attaches `PageNetworkListener` to the page if not already present.

### 3. `promiseFlow` (from [`src/tools/utils.js`](src/tools/utils.js:124))

An internal utility that executes a list of functions as a sequential Promise chain. This is the backbone of step serialization.

```js
// Executes fn[0], then fn[1], then fn[2]...
promiseFlow([fn1, fn2, fn3]);
```

### 4. PageNetworkListener (from [`src/tools/PageNetworkListener.js`](src/tools/PageNetworkListener.js))

Auto-attached to the page in the `PageRunner` constructor via `initNetworkListener()`. Intercepts network requests via `page.on('request')` / `page.on('requestfinished')` / `page.on('requestfailed')` and stores them for later inspection with `matchRequest` / `matchResponse`. Tracks `activeRequests` count in real-time.

---

## 🔧 API Reference

### DOM Navigation

| Method | Description | Implementation |
|--------|-------------|----------------|
| `moveTo(selector)` | Switch context to `page.locator(selector)` | Redirects current locator |
| `moveToChild(selector)` | Switch to `currentLocator.locator(selector)` | Nested locator |
| `moveToBody()` | Reset to `body` locator | Direct assignment |
| `moveToInitial()` | Return to initial locator | Pops entire stack |
| `moveBack(steps?)` | Go back N steps in locator stack | Pop from stack |

### Actions

| Method | Description | Pre-check |
|--------|-------------|-----------|
| `goto(url, waitForSelector?, timeout?)` | Navigate; relative URLs resolve against `page.url()` origin | — |
| `reloadPage(waitForSelector?, timeout?)` | Reload current page | — |
| `click(selector?, options?)` | Click with `toBeEnabled` pre-check | Enabled state |
| `fill(selector, text, options?)` | Fill input with pre-check | Enabled state |
| `fillForm(selector, data)` | Fill form fields by `[name]` attribute | 3x click + type |
| `press(selector, button, options?)` | Press key(s); arrays are chained | — |
| `select(selector, values)` | Select `<option>` values | — |
| `clear(selector?)` | Clear input field | — |
| `focus(selector?)` / `blur(selector?)` | Focus/blur element | — |
| `hover(selector?)` | Hover mouse over element | — |
| `uploadFile(selector, files)` | Upload file(s) | — |

### Assertions

| Method | Description | Playwright Equivalent |
|--------|-------------|----------------------|
| `see(selector?)` | Element is visible | `toBeVisible()` |
| `dontSee(selector?)` | Element is hidden | `toBeHidden()` |
| `seeText(text)` | Locator contains text | `toContainText()` |
| `seeExactText(text)` | Locator has exact text | `toHaveText()` |
| `enabled(selector?)` | Element is enabled | `toBeEnabled()` |
| `disabled(selector?)` | Element is disabled | `toBeDisabled()` via `el.disabled` |
| `checked(selector?)` | Element is checked | `el.checked` via evaluate (supports `.not`) |
| `matchValue(selector, value, strict?)` | Check input value via `matchString` | Custom |
| `matchStyles(selector, styles)` | Check CSS styles (`['display:flex']`) | Custom via `getComputedStyle` |
| `matchAttr(selector, attr)` | Check attributes (`{href: '/path'}`) | Custom via `getAttribute` |
| `has(selectors)` | Check element count; supports min/max range (supports `.not`) | Custom via `selectElements` |
| `hasUrl(urlOrPath)` | Check current URL (supports `*`/`**` wildcards) | Custom |
| `hasQueryParams(expectedParams, strict?)` | Check URL query params (⚠️ **unimplemented** — throws) | Custom |

**`has()` usage:**

```js
// Single selector — expects exactly 1 match
runer.has('button')

// Multiple selectors
runer.has(['button', 'input'])

// With count expectations — { selector: count }
runer.has({ button: 3 })

// With range — { selector: [min, max] }
runer.has({ 'div.error': [0, 2] })

// Negation — .has.not()
runer.has.not('.error-modal')
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
| `waitForNavigation(selector?, timeout?)` | Wait for page navigation + optional element |
| `waitForRequest({minCount?, timeout?})` | Wait until active requests <= minCount |
| `listenNetwork()` | Start recording requests/responses (clears previous history) |
| `stopListenNetwork()` | Stop recording |
| `matchRequest(url, matcher, timeout?)` | Find request by URL pattern and assert |
| `matchResponse(url, matcher, timeout?)` | Find response by URL pattern and assert |

### Utilities

| Method | Description |
|--------|-------------|
| `waitTime(ms?)` | Pause (default: 5000ms) |
| `pause()` | Playwright `page.pause()` (debug panel) |
| `say(text)` | `console.log` during chain execution |
| `where()` | Log current locator |
| `fullWay()` | Log entire locator stack |
| `run()` | **REQUIRED**: executes the entire chain, returns `Promise<PageRunner>` |

### Getters

| Getter | Returns |
|--------|---------|
| `runner.currentLocator` | Current Playwright `Locator` |
| `runner.currentPage` | Playwright `Page` |
| `runner.currentUrl` | `new URL(page.url())` |
| `runner.find(selector?)` | Resolved locator (current or child via `resolveLocator`) |

---

## 🔍 Selector Syntax (resolveLocator)

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
| `"Текст"` | `getByText('Текст')` | (alias, without colon) |
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
| `waitUntil` | `'networkidle'` |
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
| `version` | `1.0.2` |
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

- [`src/tools/tests/resolveLocator.test.js`](src/tools/tests/resolveLocator.test.js) — Tests for shorthand selector parsing (`resolveQuery`, `resolveQueryPiece`, `resolveText`)

---

## 📌 Important Caveats

1. **`page.networkListener`** — This property is auto-attached to the page object by the `PageRunner` constructor. Do not override or manually instantiate `PageNetworkListener`.

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

5. **`resolveLocator` chaining** — The `|>` separator creates a chain of locator queries. Each segment is resolved independently and applied sequentially on the parent locator.

6. **`.run()` is mandatory** — Without calling `.run()` at the end of the chain, no steps execute. The chain only builds a queue of promises.

7. **All methods return `this`** — Except `.run()`, which returns `Promise<PageRunner>`. This enables chaining.

8. **`hasQueryParams` is unimplemented** — The method exists but throws `throw new Error('IMPLEMENT IT')`. Do not use in tests.

9. **Negated assertion helpers** — `disabled.not`, `checked.not`, and `has.not` are set up in the `init()` method. They invert the assertion: `.checked.not(selector)` asserts the element is NOT checked, `.has.not('.error')` asserts NO matching elements exist.

10. **`fillForm` uses 3x click + type** — This method triple-clicks each field (to select all text) then types the value. For array/function values, it supports dynamic value resolution per field index.

11. **Coding conventions:**
    - Variables/functions: `camelCase`
    - Classes: `PascalCase`
    - Imports: ES modules (`import`/`export`)
    - Linting: ESLint flat config v10 via `eslint-presets`

---

## 🎯 Complete Examples

### Basic test with assertions ([`examples/zapiski.uitest.js`](examples/zapiski.uitest.js))

```js
import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';


test('Check login and registration forms', async ({ page }) => {
  await PageRunner.create(page, { debug: true })
    .goto('https://zapiski.online')
    .moveToChild('.cookiesNotification')
    .seeText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSee()
    .reloadPage()
    .dontSee()
    .moveTo('#login_frame')
    .seeText('Войти')
    .click('"Регистрация"')
    .seeText('Повторите пароль')
    .fullWay()
    .run();
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
    .matchShot('h1', 'main-heading')
    .run();
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
  .stopListenNetwork()
  .run();
```
