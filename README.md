# Playwright Runner

> A fluent chainable API wrapper over Playwright for writing declarative UI tests.

---

## Overview

**Playwright Runner** provides a lightweight, declarative wrapper around Playwright with a **fluent chainable API**. Each method call represents a single test step; steps are serialized into a Promise queue and executed only when `.run()` is called.

### Why?

| Problem | Solution |
|---------|----------|
| Playwright's native API is verbose for sequential steps | Fluent interface (method chaining) |
| Managing async execution order is manual | Automatic Promise queue serialization |
| Debugging test steps is cumbersome | Built-in debug logging via `debug: true` option |

---

## Installation

Add to package json
```json
"playwright-runner": "github:axules/playwright-runner#master",
```

### Peer Dependencies

- `@playwright/test` 1.x — x
- `playwright` 1.x — x

---

## Quick Start

```js
import { PageRunner } from '../src/runner';
import { test } from '@playwright/test';

test('Test example', async ({ page }) => {
  await PageRunner.create(page)
    .goto('https://example.com')
    .seeElement('h1')
    .expectText('Example Domain', 'h1')
    .run();
});
```

> **Note:** `.run()` is **mandatory** — without it, no waiting for all steps.

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
| `click(selector?, options?)` | Click element (with enabled pre-check) |
| `fill(selector, text, options?)` | Fill input field (with enabled pre-check) |
| `fillForm(selector, data)` | Fill form fields by `[name]` attribute |
| `pressKey(key, selector?)` | Press key(s); accepts arrays for chaining |
| `pressEnter(selector?)` | Press Enter key |
| `pressEsc(selector?)` | Press Escape key |
| `pressTab(selector?)` | Press Tab key |
| `pressSpace(selector?)` | Press Space key |
| `select(selector, values)` | Select `<option>` values |
| `clear(selector?)` | Clear input field |
| `focus(selector?)` / `blur(selector?)` | Focus / blur element |
| `hover(selector?)` | Hover mouse over element |
| `uploadFile(selector, files)` | Upload file(s) |

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
| `expectStyles(styles, selector?)` | Check CSS styles | `toHaveCSS()` |
| `expectAttributes(attr, selector?)` | Check element attributes | `toHaveAttribute()` |
| `expectElementsNumber(count, selector?)` | Check element count | `toHaveCount()` |
| `hasUrl(urlOrPath)` | Check current URL (supports `*` / `**` wildcards) | `toHaveURL()` |
| `hasQueryParams(expectedParams)` | Check URL query parameters | `toHaveURL()` callback |

### Network (in development)

| Method | Description |
|--------|-------------|
| `waitForNavigation(selector?, timeout?)` | Wait for page navigation + optional element |
| `waitForRequest({minCount?, timeout?})` | Wait until active requests <= minCount |

### Utilities

| Method | Description |
|--------|-------------|
| `pause()` | Open Playwright debug panel (`page.pause()`) |
| `say(text)` | Log text to console during chain execution |
| `where()` | Log current locator |
| `fullPath()` | Log entire locator stack |
| `run()` | **Required** — executes the entire chain, returns `Promise<PageRunner>` |

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
| `runner.find(selector?)` | Resolved locator (current or child) |
| `runner.apiContext` | Playwright `page.request` (APIRequestContext) |

---

## Selector Syntax

### CSS `:@method(arg)` Syntax

Custom directives embedded in CSS selectors for more expressive queries:

| Shorthand | Resolves To |
|-----------|-------------|
| `div:@text(Submit)` | `locator('div').filter({ hasText: 'Submit' })` |
| `*:@text(Submit)` | `getByText('Submit')` |
| `div:@role(button)` | `locator('div').getByRole('button')` |
| `form:@label(email)` | `locator('form').getByLabel('email')` |
| `input:@placeholder(Enter name)` | `locator('input').getByPlaceholder('Enter name')` |
| `a:@title(Click here)` | `locator('a').getByTitle('Click here')` |
| `div >*:@text(Content)` | `locator('div').getByText('Content')` |

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
    .expectText('Мы используем cookies для работы сервиса.')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
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

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `test` | `jest` | Run unit tests |
| `example` | `npx playwright test` | Run E2E tests |
| `report` | `npx playwright show-report` | Open Playwright HTML report |
| `build` | `babel -d dist src --ignore **/*.test.js` | Transpile source to `dist/` |

---

## Project Structure

```
playwright-runner/
├── src/
│   ├── runner.js                  # Core PageRunner class
│   └── tools/                     # Helper utilities
│       ├── createDirDeep.js       # Recursive directory creation
│       ├── diffImages.js          # Screenshot diff (pixelmatch)
│       ├── makeExpectedError.js   # Colored error formatting
│       ├── MatcherError.js        # Custom assertion error
│       ├── PageNetworkListener.js # Network monitoring
│       ├── resolveCssLocator.js   # CSS @method(arg) parser
│       ├── resolveLocator.js      # Shorthand |> parser
│       ├── RunnerLocator.js       # Programmatic locator builder
│       ├── ShotMatchError.js      # Screenshot mismatch error
│       ├── takeScreenshot.js      # Screenshot utility
│       ├── utils.js               # Shared utilities
│       └── tests/                 # Unit tests for tools
├── examples/                      # E2E test examples
├── dist/                          # Built output (Babel)
├── playwright.config.js           # Playwright configuration
├── jest.config.js                 # Jest configuration
├── babel.config.js                # Babel configuration
└── package.json
```
