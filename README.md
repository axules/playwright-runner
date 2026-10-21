# Playwright Runner

> A fluent chainable API wrapper over Playwright for writing declarative UI tests.

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Entry Point](#entry-point)
  - [DOM Navigation](#dom-navigation)
  - [Actions](#actions)
  - [Assertions](#assertions)
  - [Screenshots](#screenshots)
  - [Network](#network)
  - [Utilities](#utilities)
  - [Fetch / API](#fetch--api)
  - [Getters](#getters)
- [Selector Syntax](#selector-syntax)
  - [CSS `:@method(arg)` Syntax](#css-methodarg-syntax)
  - [`|>` Shorthand](#chain-shorthand-is-not-available-in-pagerunner)
- [Examples](#examples)
  - [Basic test with assertions](#basic-test-with-assertions)
  - [Custom function with `act()`](#custom-function-with-act)
  - [Screenshot matching](#screenshot-matching)
  - [Network request/response inspection](#network-requestresponse-inspection)
- [Scripts](#scripts)
- [Important Caveats](#important-caveats)

---

## Overview

**Playwright Runner** provides a lightweight, declarative wrapper around Playwright with a **fluent chainable API**. Each method call represents a single test step; steps are auto-executed as the chain is built.

### Why?

| Problem                                                 | Solution                                                     |
|---------------------------------------------------------|--------------------------------------------------------------|
| Playwright's native API is verbose for sequential steps | Fluent interface (method chaining)                           |
| Managing async execution order is manual                | Automatic Promise queue serialization via `this.actionsPull` |
| Unclear assertion error messages                        | Custom `MatcherError` with colored Expected/Received         |
| Screenshot diffing requires boilerplate                 | Built-in `matchShot` with pixelmatch integration             |
| Debugging test steps is cumbersome                      | Built-in debug logging via `debug: true` option              |

---

## Installation

Add to package.json:

```
"playwright-runner": "github:axules/playwright-runner#master",
```

The package ships both `dist/` (transpiled, referenced by `main` / `exports`) and `src/`:

```js
import { PageRunner } from 'playwright-runner';        // dist/runner.js
import { PageRunner } from 'playwright-runner/runner'; // same entry
import { PageRunner } from '../src/runner';            // local checkout
```

### Dependencies

- **Runtime:** `lodash.isstring`, `jpeg-js`, `pixelmatch`
- **Peer:** `@playwright/test` 1.x - x, `playwright` 1.x - x
- **Dev:** Playwright, Jest, Babel (ES modules), ESLint + plugins, cross-env

---

## Quick Start

```js
import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';

test('Test example', async ({ page }) => {
  await PageRunner.new(page)
    .goto('https://example.com')
    .seeElement('h1')
    .expectText('Example Domain', 'h1');
});
```

---

## API Reference

### Entry Point

| Method                                   | Description                                                                                                   |
|------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `PageRunner.new(pageOrLocator, config?)` | Create a new runner instance. Accepts a Playwright `Page` (wrapped as `page.locator('html')`) or a `Locator`. |
| `new PageRunner(pageOrLocator, config?)` | Same as above, called as a constructor.                                                                       |

**Config options:**

| Option  | Type      | Default | Description                   |
|---------|-----------|---------|-------------------------------|
| `debug` | `boolean` | `false` | Logs each step with timestamp |

### DOM Navigation

These methods **push** onto an internal locator stack; they never replace it. Use `withinBack` / `withinInitial` to pop.

| Method                     | Description                                                                                                     |
|----------------------------|-----------------------------------------------------------------------------------------------------------------|
| `within(selector)`         | Push `currentLocator.locator(selector)` (resolved via `resolveLocator`)                                         |
| `withinChild(selector)`    | Push a child of the current locator, resolved via `find(selector)`                                              |
| `withinBody()`             | Push the `body` locator                                                                                         |
| `withinInitial()`          | Drop the whole stack, returning to the initial locator                                                          |
| `withinBack(stepsNumber?)` | Pop the top locator (default `1` step); falls back to the initial locator and warns if the stack is too shallow |
| `pushLocator(selector)`    | Push a locator onto the stack immediately (not queued)                                                          |

### Actions

| Method                                                                                        | Description                                                                                                                                                   |
|-----------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `goto(url, waitForSelector?, options?)`                                                       | Navigate to URL, then optionally wait for `waitForSelector` to be visible. `options` are Playwright `page.goto` options (merged over `{ waitUntil: 'load' }`) |
| `reloadPage(waitForSelector?, options?)`                                                      | Reload the page, then optionally wait for `waitForSelector`. `options` are Playwright `page.reload` options                                                   |
| `click(selector?, options?)`                                                                  | Click the first matching element                                                                                                                              |
| `clickContent(text, options?)`                                                                | Click the first element whose text matches `text` (uses `*:@text(...)`)                                                                                       |
| `doubleClick(selector?, options?)`                                                            | Double-click the first matching element                                                                                                                       |
| `fill(selector, text, options?)`                                                              | Fill an input field                                                                                                                                           |
| `fillForm(data, parent?)`                                                                     | Fill fields by `[name]` attribute, scoped to `find(parent)` (current locator by default). Truthy values use `fill(String(value))`, falsy values use `clear()` |
| `pressKey(key, element?)`                                                                     | Press key(s) on `find(element).first()` or the page keyboard. `key` may be an array, pressed sequentially                                                     |
| `pressEnter(element?)` / `pressEsc(element?)` / `pressTab(element?)` / `pressSpace(element?)` | Convenience shortcuts for common keys                                                                                                                         |
| `select(selector, values)`                                                                    | Select `<option>` value(s) (`selectOption`)                                                                                                                   |
| `clear(selector?)`                                                                            | Clear an input field                                                                                                                                          |
| `focus(selector?)` / `blur(selector?)`                                                        | Focus / blur an element                                                                                                                                       |
| `hover(selector?)`                                                                            | Hover the mouse over an element                                                                                                                               |
| `uploadFile(selector, files)`                                                                 | Upload file(s) via `setInputFiles`                                                                                                                            |
| `scrollIntoViewIfNeeded(selector?, options?)`                                                 | Scroll an element into view                                                                                                                                   |
| `dragTo(selector, target, options?)`                                                          | Drag an element onto `find(target)`                                                                                                                           |
| `drop(selector, payload, options?)`                                                           | Drop `payload` on an element                                                                                                                                  |
| `highlight(selector?)`                                                                        | Highlight an element (Playwright debug feature)                                                                                                               |
| `highlightOff(selector?)`                                                                     | Remove the highlight (`hideHighlight`)                                                                                                                        |

### Assertions

| Method                                   | Description                                     | Playwright Equivalent         |
|------------------------------------------|-------------------------------------------------|-------------------------------|
| `seeElement(selector?)`                  | Element is visible                              | `toBeVisible()`               |
| `dontSeeElement(selector?)`              | Element is hidden                               | `toBeHidden()`                |
| `expectVisible(selector?)`               | Element is visible (alias of `seeElement`)      | `toBeVisible()`               |
| `expectHidden(selector?)`                | Element is hidden (alias of `dontSeeElement`)   | `toBeHidden()`                |
| `expectText(text, selector?)`            | Locator contains text                           | `toContainText()`             |
| `dontExpectText(text, selector?)`        | Locator does not contain text                   | `not.toContainText()`         |
| `expectExactText(text, selector?)`       | Locator has exactly this text                   | `toHaveText()`                |
| `expectEnabled(selector?)`               | Element is enabled                              | `toBeEnabled()`               |
| `expectDisabled(selector?)`              | Element is disabled                             | `toBeDisabled()`              |
| `expectValue(selector, value)`           | Input has the given value                       | `toHaveValue()`               |
| `expectStyles(styles, selector?)`        | Check CSS styles (`{ display: 'flex' }`)        | `toHaveCSS()` per entry       |
| `expectAttributes(attr, selector?)`      | Check attributes (`{ href: '/path' }`)          | `toHaveAttribute()` per entry |
| `expectElementsNumber(count, selector?)` | Check the number of matching elements           | `toHaveCount()`               |
| `expectUrl(urlOrPath)`                   | Check the current page URL                      | `toHaveURL()`                 |
| `expectQueryParams(expectedParams)`      | Check URL query parameters                      | `toHaveURL()` callback        |
| `expectFetch(url, options, expected)`    | Fetch, then assert status / body / partial body | `number`, function, or object |

**`expectUrl()` usage:**

```js
// Full URL match
runner.expectUrl('https://example.com/page')

// Same origin + path
runner.expectUrl('*/path')

// Any URL ending with /path
runner.expectUrl('**/path')

// RegExp is passed to Playwright as-is
runner.expectUrl(/example\.com/)
```

**`expectQueryParams()` usage:**

```js
runner.expectQueryParams({ page: 2, sort: 'date' })
```

**`expectFetch(expected)` usage:**

`expected` can be:

| Form                                         | Description                                                                        |
|----------------------------------------------|------------------------------------------------------------------------------------|
| `200`                                        | Assert the HTTP status code                                                        |
| `(response) => { ... }`                      | Custom assertion callback, receives the raw `APIResponse`                          |
| `{ status: 200 }`                            | Assert the HTTP status code                                                        |
| `{ status: 200, data: 'body text' }`         | Status + exact string body (`toBe`)                                                |
| `{ status: 200, data: { ok: true } }`        | Status + deep-equal JSON body (`toEqual`)                                          |
| `{ containsData: { ok: true } }`             | Status + partial JSON match (`toMatchObject`)                                      |
| `{ containsData: [1, 2] }`                   | Status + array subset check (`arrayContaining`, only for JSON responses)           |
| `{ check: (response) => { ... } }`           | Custom async assertion callback, receives the raw `APIResponse`                    |

### Screenshots

`saveShot`, `savePageShot` and `matchShot` require `runner.screenshotTool` to be set (see [Screenshot matching](#screenshot-matching)).

| Method                                    | Description                                                                                                                                                                         |
|-------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `saveShot(selector, name)`                | Save an element screenshot. Falls back to the current locator if `selector` is omitted, but throws if neither is available                                                          |
| `savePageShot(name)`                      | Save a full-page screenshot                                                                                                                                                         |
| `matchShot(selector, name, saveCurrent?)` | Compare with the reference. Saves if the reference is missing, `saveCurrent` is `true`, or `runner.updateShot` is set; otherwise diffs via `diffImages` and throws `ShotMatchError` |

### Network

Network matchers require `page.networkListener` (a `PageNetworkListener`) attached manually — see [Network request/response inspection](#network-requestresponse-inspection).

| Method                                  | Description                                                                                        |
|-----------------------------------------|----------------------------------------------------------------------------------------------------|
| `listenNetwork()`                       | Start recording requests, clearing previous history                                                |
| `stopListenNetwork()`                   | Stop recording                                                                                     |
| `matchRequest(url, matcher, timeout?)`  | Pass the last matching request to `matcher`. Checks synchronously — it does not poll for `timeout` |
| `matchResponse(url, matcher, timeout?)` | Pass the last matching finished request's response to `matcher`. Also synchronous                  |

### Utilities

| Method                                                  | Description                                                                                                   |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `waitTime(ms?)`                                         | Pause (default `500`ms)                                                                                       |
| `pause()`                                               | Open the Playwright debug panel (`page.pause()`)                                                              |
| `say(text)`                                             | Log text to the console during chain execution                                                                |
| `sayWhere()`                                            | Log the current locator                                                                                       |
| `sayFullPath()`                                         | Log the entire locator stack                                                                                  |
| `act(func)`                                             | Run a function as a step. Receives `{ runner, page, expect }` (`runner` is a clone sharing the locator stack) |
| `then(onFulfilled?, onRejected?)`                       | Thenable interface; lets you `await` the runner instance                                                      |
| `waitForRequestAfterTrigger(checkRequest, triggerFn)`   | Call `triggerFn({ runner, page, waiter, expect })`, then await the matching request                           |
| `waitForResponseAfterTrigger(checkResponse, triggerFn)` | Same as above for a response                                                                                  |
| `waitForFunction(callback)`                             | Wait until `callback` (evaluated in the page) returns a truthy value                                          |
| `clone()`                                               | Shallow clone sharing the locator stack but with a fresh action queue                                         |

### Fetch / API

| Method                                | Description                                                                                           |
|---------------------------------------|-------------------------------------------------------------------------------------------------------|
| `fetch(url, options?)`                | `apiContext.fetch()` resolved against the page origin. Returns `Promise<APIResponse>` (not chainable) |
| `expectFetch(url, options, expected)` | Fetch and assert the response. Chainable                                                              |

`expected` accepts a status number, a function, or an object:

```
200                                          // status code only
(response) => { ... }                        // custom assertion callback
{ status: 200 }                              // status check
{ status: 200, data: 'body text' }           // status + exact text (toBe)
{ status: 200, data: { ok: true } }          // status + deep-equal JSON (toEqual)
{ containsData: { ok: true } }               // partial JSON match (toMatchObject)
{ containsData: [1, 2] }                     // array subset check (arrayContaining)
{ check: (res) => { ... } }                  // custom callback on the raw APIResponse
```

URL resolution in `fetch` / `expectFetch`:

| Input               | Resolved to                               |
|---------------------|-------------------------------------------|
| `https://host/path` | as-is                                     |
| `/path`             | `currentOrigin.replace(path)`             |
| `path`              | `${currentOrigin}${currentPathname}/path` |

### Getters

| Getter                           | Returns                                                                                                                                                             |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `runner.currentLocator`          | Current Playwright `Locator` (top of the stack)                                                                                                                     |
| `runner.initialLocator`          | Initial Playwright `Locator` (first in the stack)                                                                                                                   |
| `runner.currentPage`             | Playwright `Page` extracted from the current locator                                                                                                                |
| `runner.currentUrl`              | `new URL(page.url())`                                                                                                                                               |
| `runner.find(selector?)`         | Resolved `Locator`. No argument → current locator; a selector starting with `body` → resolved from the page root; anything else → resolved from the current locator |
| `runner.findFirst(selector?)`    | Same as `find()`, then `.first()` (unless it is a Page or `'body'`)                                                                                                 |
| `runner.resolveLocator(locator)` | Rewrites the current locator to `resolveCssLocator(currentPage, locator)`. Note: despite the name, this does **not** support the `\|>` shorthand                    |
| `runner.apiContext`              | Playwright `page.request` (APIRequestContext)                                                                                                                       |

---

## Selector Syntax

The runner understands one selector dialect: CSS with `:@method(arg)` directives, parsed by [`resolveCssLocator`](src/tools/resolveCssLocator.js). Every selector taking method (`within`, `find`, `click`, `expectText`, …) supports it.

`selector` parameters also accept a raw Playwright `Locator`, or an array mixing CSS strings and `{ method, arg, node }` descriptors.

### CSS `:@method(arg)` Syntax

| Shorthand                                     | Resolves To                                          | Example                                  |
|-----------------------------------------------|------------------------------------------------------|------------------------------------------|
| `div:@text(Submit)`                           | `locator('div').filter({ hasText: 'Submit' })`       | Filter by text (no node)                 |
| `*:@text(Submit)`                             | `getByText('Submit')`                                | Find child by text (with node)           |
| `div:*@text(Submit)` / `div >*:@text(Submit)` | `locator('div').getByText('Submit')`                 | Node prefix makes `:@text` a `getByText` |
| `div:@role(button)`                           | `locator('div').getByRole('button')`                 | Match by ARIA role                       |
| `form:@label(email)`                          | `locator('form').getByLabel('email')`                | Match by label                           |
| `input:@placeholder(Enter name)`              | `locator('input').getByPlaceholder('Enter name')`    | Match by placeholder                     |
| `a:@title(Click here)`                        | `locator('a').getByTitle('Click here')`              | Match by title                           |
| `div:@text("Submit (123)")`                   | `locator('div').filter({ hasText: 'Submit (123)' })` | Quoted arg with parentheses              |
| `li:@at(2)`                                   | `locator('li').nth(2)`                               | Select nth element (zero-based)          |
| `li:@first()`                                 | `locator('li').first()`                              | Select the first element                 |
| `li:@last()`                                  | `locator('li').last()`                               | Select the last element                  |

`:@` directives can be chained on the same selector (`div:@text(Submit):@role(button)`), and method names are case-insensitive. A directive without a preceding selector and without a `*` node (e.g. `` ` :@text(x)` ``) throws.

**Wildcard `*` behavior:** for `text`, `label`, `role`, `placeholder` and `title`, `*` becomes `.*` in a case-insensitive, fully anchored RegExp.  
Examples: `div:@text("*hello*")` → `/^.*hello.*$/i`, `:edit*` → `/^edit.*$/i`.

### Chain shorthand is not available in PageRunner

[`resolveLocator.js`](src/tools/resolveLocator.js) also exports a `|>` shorthand parser (`resolveText`, `resolveQueryPiece`, `resolveQuery`, `resolveLocator`). It is used internally by [`RunnerLocator`](src/tools/RunnerLocator.js) for programmatic selector building, **not** by `PageRunner` methods — no `runner.*` selector parameter routes through it.

If you use the tools directly:

| Shorthand           | Resolves To                                          |
|---------------------|------------------------------------------------------|
| `button`            | `locator('button')`                                  |
| `:"Текст"`          | `getByText('Текст')`                                 |
| `"Текст"`           | `filter({ hasText: 'Текст' })` (alias without colon) |
| `:~метка`           | `getByLabel('метка')`                                |
| `:button"Кнопка"`   | `getByRole('button', { name: 'Кнопка' })`            |
| `*` in any text arg | `/^.*текст.*$/i` (case-insensitive)                  |

```js
resolveLocator(page.locator('body'), 'div.form |> :button"Сохранить"')
// → locator('body').locator('div.form').getByRole('button', { name: 'Сохранить' })
```

---

## Examples

### Basic test with assertions

Taken from [`examples/zapiski.uitest.js`](examples/zapiski.uitest.js):

```js
import { test } from '@playwright/test';

import { PageRunner } from '../src/runner';

test('Check login and registration forms', async ({ page }) => {
  await PageRunner.new(page, { debug: true })
    .goto('https://zapiski.online')
    .within('.cookiesNotification')
    .expectText('Мы используем cookies для работы сервиса. Продолжая пользоваться сервисом ЗапискиОнлайн, вы принимаете')
    .click('button')
    .dontSeeElement()
    .reloadPage()
    .dontSeeElement()
    .within('#login_frame')
    .expectText('Войти')
    .clickContent('Войти')
    .act(async ({ runner }) => {
      await runner.click('li:@text(Регистрация)');
      await runner.expectText('Повторите пароль');
    })
    .sayWhere()
    .sayFullPath()
    .expectFetch('/json/m_authf/aj_get_info', {}, { status: 200 })
    .act(async ({ page }) => {
      await page.setViewportSize({ width: 640, height: 640 });
    })
    .dontExpectText('12345');
});
```

### Custom function with `act()`

`act` receives a cloned runner sharing the same locator stack, so you can keep chaining inside it:

```js
await PageRunner.new(page)
  .goto('https://example.com')
  .act(async ({ page, expect }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator('.footer')).toBeVisible();
  })
  .seeElement('.footer');
```

### Screenshot matching

`matchShot` needs `screenshotTool` from [`src/tools/takeScreenshot.js`](src/tools/takeScreenshot.js):

```js
import { screenshotTool } from '../src/tools/takeScreenshot';

const runner = PageRunner.new(page);
runner.screenshotTool = screenshotTool('screenshots/my-test');

await runner
  .goto('https://example.com')
  .matchShot('h1', 'main-heading')
  .savePageShot('full-page');
```

### Network request/response inspection

The runner does not attach a network listener; do it yourself after the page exists:

```js
import { PageNetworkListener } from '../src/tools/PageNetworkListener';

const runner = PageRunner.new(page);
runner.currentPage.networkListener = new PageNetworkListener(runner.currentPage);

await runner
  .goto('https://example.com')
  .listenNetwork()
  .click('button:@text(Отправить)')
  .matchResponse('/api/submit', async (response) => {
    const data = await response.json();
    expect(data.status).toBe('ok');
  })
  .stopListenNetwork();
```

---

## Scripts

| Script    | Command                                                         | Description                     |
|-----------|-----------------------------------------------------------------|---------------------------------|
| `test`    | `jest`                                                          | Run unit tests                  |
| `example` | `npx playwright test`                                           | Run E2E tests                   |
| `report`  | `npx playwright show-report`                                    | Open the Playwright HTML report |
| `build`   | `babel --delete-dir-on-start -d dist src --ignore **/*.test.js` | Transpile `src/` to `dist/`     |

Update reference screenshots with `cross-env NODE_MODE=update npx playwright test`.

---

## Important Caveats

1. **`page.networkListener`** — Not attached automatically. Create it before calling `listenNetwork()`: `page.networkListener = new PageNetworkListener(page)`.
2. **Most methods return `this`** — That is what enables chaining. Getters (`currentLocator`, `find()`, `currentPage`, …) return locators, and `fetch()` returns a `Promise<APIResponse>`.
3. **`matchShot` requires `screenshotTool`** — Set `runner.screenshotTool` (e.g. `screenshotTool(dir)`). It is also used by `saveShot` / `savePageShot`. `updateShot` is read from the runner at call time.
4. **`fillForm` uses `fill` / `clear`** — Truthy values go through `fill(String(value))`, falsy values through `clear()`.
5. **`matchRequest` / `matchResponse` do not wait** — They inspect already-recorded requests and throw a `MatcherError` immediately if nothing matches. The `timeout` argument only affects the error message.
6. **`expectQueryParams`** — Validates via a `toHaveURL()` callback; on failure it throws an error listing mismatched params.
7. **`within*` pushes, it does not replace** — Use `withinBack()` / `withinInitial()` to unwind the locator stack.
8. **Coding conventions:** camelCase variables/functions, PascalCase classes, ES modules (`import`/`export`), ESLint flat config v10.
