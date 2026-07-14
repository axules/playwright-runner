# Playwright Runner

> A fluent chainable API wrapper over Playwright for writing declarative UI tests.

---

## Overview

**Playwright Runner** provides a lightweight, declarative wrapper around Playwright with a **fluent chainable API**. Each method call represents a single test step; steps are auto-executed as the chain is built.

### Why?

| Problem | Solution |
|---------|----------|
| Playwright's native API is verbose for sequential steps | Fluent interface (method chaining) |
| Managing async execution order is manual | Automatic Promise queue serialization via `this.actionsPull` |
| Unclear assertion error messages | Custom `MatcherError` with colored Expected/Received |
| Screenshot diffing requires boilerplate | Built-in `matchShot` with pixelmatch integration |
| Debugging test steps is cumbersome | Built-in debug logging via `debug: true` option |

---

## Installation

Add to package.json:

```json
"playwright-runner": "github:axules/playwright-runner#master",
```

### Dependencies

- **Runtime:** `lodash.isstring`, `jpeg-js`, `pixelmatch`
- **Peer:** `@playwright/test` 1.x - x, `playwright` 1.x - x
- **Dev:** Playwright, Jest, Babel (ES modules), ESLint + plugins, cross-env

---

## Quick Start

```js
import { PageRunner } from '../src/runner';
import { test } from '@playwright/test';

test('Test example', async ({ page }) => {
  await PageRunner.create(page)
    .goto('https://example.com')
    .seeElement('h1')
    .expectText('Example Domain', 'h1');
});
```
---

## API Reference

### Entry Point

| Method | Description |
|--------|-------------|
| `PageRunner.create(pageOrLocator, config?)` | Create a new runner instance. Accepts a Playwright `Page` or `Locator`. |

**Config options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debug` | `boolean` | `false` | Logs each step with timestamp |

### DOM Navigation

| Method | Description |
|--------|-------------|
| `within(selector)` | Switch context to `page.locator(selector)` |
| `withinChild(selector)` | Switch to `currentLocator.locator(selector)` |
| `withinBody()` | Reset to `body` locator |
| `withinInitial()` | Return to initial locator (pops entire stack) |
| `withinBack(steps?)` | Go back N steps in locator stack |

### Actions

| Method | Description |
|--------|-------------|
| `goto(url, waitForSelector?, timeout?)` | Navigate to URL (relative paths resolve against current origin) |
| `reloadPage(waitForSelector?, timeout?)` | Reload current page |
| `click(selector?, options?)` | Click element |
| `fill(selector, text, options?)` | Fill input field |
| `fillForm(data, parent?)` | Fill form fields by `[name]` attribute; calls `fill` / `clear` per field |
| `pressKey(key, selector?)` | Press key(s); accepts arrays for chaining |
| `pressEnter(selector?)` / `pressEsc(selector?)` / `pressTab(selector?)` / `pressSpace(selector?)` | Convenience shortcuts for common keys |
| `select(selector, values)` | Select `<option>` values |
| `clear(selector?)` | Clear input field |
| `focus(selector?)` / `blur(selector?)` | Focus / blur element |
| `hover(selector?)` | Hover mouse over element |
| `uploadFile(selector, files)` | Upload file(s) |
| `scrollIntoViewIfNeeded(selector?, options?)` | Scroll element into view |
| `dragTo(selector, target, options?)` | Drag an element to a target element |
| `drop(selector, payload, options?)` | Drop data on an element |
| `highlight(selector?)` | Highlight an element (Playwright debug feature) |
| `highlightOff(selector?)` | Remove highlight from an element |

### Assertions

| Method | Description | Playwright Equivalent |
|--------|-------------|----------------------|
| `seeElement(selector?)` | Element is visible | `toBeVisible()` |
| `dontSeeElement(selector?)` | Element is hidden | `toBeHidden()` |
| `expectVisible(selector?)` | Element is visible | `toBeVisible()` |
| `expectHidden(selector?)` | Element is hidden | `toBeHidden()` |
| `expectText(text, selector?)` | Locator contains text | `toContainText()` |
| `expectExactText(text, selector?)` | Locator has exact text | `toHaveText()` |
| `expectEnabled(selector?)` | Element is enabled | `toBeEnabled()` |
| `expectDisabled(selector?)` | Element is disabled | `toBeDisabled()` |
| `expectValue(selector, value)` | Check input value | `toHaveValue()` |
| `expectStyles(styles, selector?)` | Check CSS styles (`{ display: 'flex' }`) | `toHaveCSS()` |
| `expectAttributes(attr, selector?)` | Check element attributes (`{ href: '/path' }`) | `toHaveAttribute()` |
| `expectElementsNumber(count, selector?)` | Check element count | `toHaveCount()` |
| `hasUrl(urlOrPath)` | Check current URL (supports `*` / `**` wildcards) | `toHaveURL()` |
| `hasQueryParams(expectedParams)` | Check URL query parameters | `toHaveURL()` callback |

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
| `pause()` | Open Playwright debug panel (`page.pause()`) |
| `say(text)` | Log text to console during chain execution |
| `sayWhere()` | Log current locator |
| `sayFullPath()` | Log entire locator stack |
| `act(func)` | Execute arbitrary user function as a step (receives `{ runner, page }`) |
| `then(onFulfilled?, onRejected?)` | Thenable interface; enables `await` on the runner instance directly |
| `waitForRequestAfterTrigger(triggerFn, checkRequest)` | Trigger an action and wait for a specific network request |
| `waitForFunction(callback)` | Wait for a function to return a truthy value (`page.waitForFunction`) |

### Fetch / API

| Method | Description |
|--------|-------------|
| `fetch(url, options?)` | Make HTTP request relative to current page origin |
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

## Selector Syntax

### CSS `:@method(arg)` Syntax

Custom directives embedded in CSS selectors for more expressive queries. Parsed by [`resolveCssLocator`](src/tools/resolveCssLocator.js).

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

**Wildcard `*` behavior:** In `text`, `label`, `role`, `placeholder`, and `title` methods, `*` is converted to a regex (`.*`) with case-insensitive flag.  
Example: `div:@text("*hello*")` → `locator('div').filter({ hasText: /^.*hello.*$/i })`

### Shorthand `|>` Syntax

A compact shorthand syntax parsed by [`resolveLocator`](src/tools/resolveLocator.js) for writing readable locator chains. Use `|>` to chain multiple queries.

| Shorthand | Resolves To | Example |
|-----------|-------------|---------|
| `button` | `locator('button')` | CSS/tag selector (default) |
| `:"Текст"` | `getByText('Текст')` | Exact text match |
| `:"*текст*"` | `getByText(/текст/i)` | Case-insensitive substring |
| `"Текст"` | `filter({ hasText: 'Текст' })` | Filter by text (alias, without colon) |
| `:button"Кнопка"` | `getByRole('button', { name: 'Кнопка' })` | Role + accessible name |
| `:button"*кнопк*"` | `getByRole('button', { name: /кнопк/i })` | Role + regex name |
| `:~метка` | `getByLabel('метка')` | By `aria-label` or associated `<label>` |
| `:~*метк*` | `getByLabel(/метк/i)` | Label with regex |

**Chaining with `|>`:**

```
div.form |> :button"Сохранить"
// 1. locator('div.form')
// 2. .getByRole('button', { name: 'Сохранить' })
```

**Wildcard `*` behavior:** In text/role/label queries, `*` is converted to a regex (`.*`) with case-insensitive flag.  
Example: `"*hello*"` → `/^.*hello.*$/i`

---

## Examples

### Basic test with assertions

```js
import { test } from '@playwright/test';
import { PageRunner } from '../src/runner';

test('Check login and registration forms', async ({ page }) => {
  await PageRunner.create(page, { debug: true })
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
    .expectFetch('/json/m_authf/aj_get_info', {}, { status: 200 })
    .act(async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 640 });
    });
});
```

### Custom function with `act()`

```js
await PageRunner.create(page)
  .goto('https://example.com')
  .act(async ({ runner, page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  })
  .seeElement('.footer');
```

### Screenshot matching

```js
await PageRunner.create(page, {
  screenshotTool: screenshotTool('screenshots/my-test')
})
  .goto('https://example.com')
  .matchShot('h1', 'main-heading');
```

### Network request/response inspection

```js
import { PageNetworkListener } from '../src/tools/PageNetworkListener'; // manual setup

await PageRunner.create(page)
  .goto('https://example.com')
  .act(({ page }) => {
    page.networkListener = new PageNetworkListener(page); // attach listener
  })
  .listenNetwork()
  .click('"Отправить"')
  .matchResponse('/api/submit', async (response) => {
    const data = await response.json();
    expect(data.status).toBe('ok');
  })
  .stopListenNetwork();
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `jest` | Run unit tests |
| `example` | `npx playwright test` | Run E2E tests |
| `report` | `npx playwright show-report` | Open Playwright HTML report |
| `build` | `babel --delete-dir-on-start -d dist src --ignore **/*.test.js` | Transpile source to `dist/` |

---

## Project Structure

```
playwright-runner/
├── src/
│   ├── runner.js                  # 🔥 Core PageRunner class
│   └── tools/
│       ├── createDirDeep.js       # Recursive directory creation
│       ├── diffImages.js          # Screenshot diff (pixelmatch)
│       ├── makeExpectedError.js   # Colored error formatting (red/green)
│       ├── MatcherError.js        # Custom assertion error class
│       ├── PageNetworkListener.js # Network request/response monitoring
│       ├── resolveCssLocator.js   # CSS @method(arg) selector parser
│       ├── resolveLocator.js      # Shorthand |> selector parser
│       ├── RunnerLocator.js       # Programmatic locator builder class
│       ├── screenshotReporter.js  # Legacy Jasmine screenshot reporter
│       ├── ShotMatchError.js      # Screenshot mismatch error
│       ├── takeScreenshot.js      # Screenshot utility with URL overlay
│       ├── utils.js               # Shared utilities (selectors, styles, attrs)
│       └── tests/                 # Unit tests for tools
│           ├── resolveCssLocator.test.js
│           └── resolveLocator.test.js
├── examples/                      # E2E test examples
├── dist/                          # Built output (Babel)
├── playwright.config.js           # Playwright configuration
├── jest.config.js                 # Jest configuration
├── babel.config.js                # Babel configuration
├── eslint.config.js               # ESLint flat config (v10)
├── agents.md                      # AI-Optimized Context spec
└── package.json
```

---

## Important Caveats

1. **`page.networkListener`** — This property is **not** auto-attached by the `PageRunner` constructor. Attach manually if needed: `initNetworkListener(this._page)`.

2. **All methods return `this`** — This enables chaining. Use `await` on the runner to resolve the promise.

3. **`matchShot` behavior** — Screenshots are saved if: no reference file exists, `updateShot: true` (or `NODE_MODE=update` is set), or `saveCurrent` parameter is `true`. Otherwise they are compared using `diffImages` (pixelmatch), and a `ShotMatchError` is thrown on mismatch.

4. **`fillForm` uses `fill` / `clear`** — Calls `fill(String(value))` or `clear()` per field (not triple-click).

5. **`resolveLocator` chaining** — The `|>` separator creates a chain of locator queries. Each segment is resolved independently and applied sequentially on the parent locator.

6. **`hasQueryParams`** — Uses `toHaveURL()` callback to validate query parameters.

7. **Coding conventions:** camelCase variables/functions, PascalCase classes, ES modules (`import`/`export`), ESLint flat config v10.
