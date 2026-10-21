# playwright-runner

Fluent chainable wrapper over Playwright. Each method call enqueues one test step; steps run sequentially in the order they are chained. Author: Denis Shelest (<axules@mail.ru>).

- **Runtime deps:** `lodash.isstring`, `jpeg-js`, `pixelmatch`
- **Peers:** `playwright`, `@playwright/test` (`1.x - x`)
- **Entry:** `src/runner.js` → `dist/runner.js` (main/exports). Also `./tools/*` → `dist/tools/*.js`.

```js
import { PageRunner } from 'playwright-runner/runner'; // or '../src/runner'
await PageRunner.new(page, { debug: true }).goto('https://example.com').seeElement('h1');
```

## Layout

```
src/runner.js                       PageRunner (only entry class)
src/tools/resolveCssLocator.js      `:@method(arg)` selector parser (+ .test.js)
src/tools/resolveLocator.js         `|>` shorthand selector parser (+ .test.js)
src/tools/takeScreenshot.js         takeScreenshot + screenshotTool(dir) factory
src/tools/PageNetworkListener.js    request tracking, attached as page.networkListener
src/tools/utils.js                  isPage, getPage, promiseFlow, getStyles, matchString...
src/tools/{diffImages,createDirDeep,makeExpectedError,MatcherError,ShotMatchError,screenshotReporter}.js
examples/*.uitest.js                Playwright e2e tests (not executed by jest)
dist/                               babel output — never edit, regenerate with npm run build
```

## Core mechanics

| Member         | Behavior                                                                                                                                                                                             |
|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `actionsPull`  | Array of promises; `_pushAction` chains each new step onto the last one (runner.js:226)                                                                                                              |
| `_locatorsWay` | Locator stack (note underscore). `within*` push, `withinBack`/`withinInitial` re-slice                                                                                                               |
| `_config`      | Constructor `options` object                                                                                                                                                                         |
| `debug: true`  | Installs a timestamped `this.log`; also prints caller stack lines                                                                                                                                    |
| `then`         | Makes the runner awaitable: `await runner` waits for the last queued step                                                                                                                            |
| `clone()`      | New runner sharing `_locatorsWay`, fresh `actionsPull`; passed to `act`/`waitFor*AfterTrigger` callbacks                                                                                             |
| Errors         | `_createMatcher` rewrites `error.stack`/`error.message` with method name and current locator — traces point at the call site, not the failing line                                                   |
| Constructor    | Accepts Page (wrapped as `page.locator('html')`) or Locator. Only `debug` is handled by `init()`; `screenshotTool` and `updateShot` are read by the screenshot methods but must be assigned manually |

## API

All step methods return `this`. Getters: `currentLocator`, `initialLocator`, `currentPage`, `currentUrl`, `apiContext`.

**Scoping:** `within(sel)` · `withinChild(sel)` (resolved via `find`) · `withinBody()` · `withinBack(n=1)` · `withinInitial()` · `pushLocator(sel)` (sync, no queue)

**Lookup:** `find(sel?)` — current locator or CSS child; a selector starting with `body` resolves from the page root. `findFirst(sel?)` — same, `.first()` unless Page/`body`. `resolveLocator(locator)`

**Assertions:** `seeElement` · `dontSeeElement` · `expectVisible` · `expectHidden` · `expectEnabled` · `expectDisabled` · `expectText(text, sel?)` (contains) · `dontExpectText` · `expectExactText` · `expectValue(field, value)` · `expectStyles(obj, sel?)` · `expectAttributes(obj, sel?)` · `expectElementsNumber(n, sel?)`

**URL:** `expectUrl(urlOrPath)` — string, RegExp, or `'*/path'` (same origin) / `'**/path'` (any origin). `expectQueryParams(obj)`

**Actions:** `goto(url, waitForSelector?, options?)` (relative URLs resolve against page origin) · `reloadPage(waitForSelector?, options?)` · `click` · `clickContent(text)` · `doubleClick` · `fill(sel, text)` · `fillForm(data, parent?)` (by `[name]`, falsy value clears) · `pressKey(key|keys[], sel?)` · `pressEnter`/`pressEsc`/`pressTab`/`pressSpace` · `select` · `clear` · `focus` · `blur` · `hover` · `uploadFile` · `scrollIntoViewIfNeeded` · `dragTo` · `drop` · `highlight` · `highlightOff`

**Waiting:** `waitTime(ms=500)` · `pause()` · `waitForFunction(cb)` (note: recurses into itself — runner.js:476) · `waitForRequestAfterTrigger(checkRequest, triggerFn)` · `waitForResponseAfterTrigger(checkResponse, triggerFn)` — callback receives `{ runner, page, waiter, expect }`

**Screenshots:** `saveShot(sel?, name)` · `savePageShot(name)` · `matchShot(sel?, name, saveCurrent=false)` — saves if reference missing, `saveCurrent`, or `this.updateShot`; otherwise pixelmatch, throws `ShotMatchError`. Requires `this.screenshotTool` = `screenshotTool(dir)` (or a `.uitest.js` suite object).

**Network:** `listenNetwork()` · `stopListenNetwork()` · `matchRequest(url, matcher, timeout=2000)` · `matchResponse(url, matcher, timeout=10000)`. All require `page.networkListener = new PageNetworkListener(page)` set manually — there is no `initNetworkListener()`. `matcher` receives a Playwright `Request` / `Response`.

**API:** `fetch(url, options?)` → `page.request.fetch` with origin-relative URL resolution · `expectFetch(url, options, { status?, data? })`

**Misc:** `act(fn)` — `fn({ runner, page, expect })` · `say(text)` · `sayWhere()` · `sayFullPath()`

## Selectors

`resolveCssLocator` — `:@method(arg)` directives:

| Syntax                                                           | Result                                           |
|------------------------------------------------------------------|--------------------------------------------------|
| `div:@text(Submit)`                                              | `locator('div').filter({ hasText: 'Submit' })`   |
| `*:@text(Submit)`                                                | `...getByText('Submit')`                         |
| `div:@role(button)`                                              | `locator('div').getByRole('button')`             |
| `form:@label(email)` / `input:@placeholder(..)` / `a:@title(..)` | `getByLabel` / `getByPlaceholder` / `getByTitle` |
| `div:@text("Submit (123)")`                                      | quoted arg may contain parentheses               |
| `li:@at(0)` / `li:@first()` / `li:@last()`                       | `nth(0)` / `first()` / `last()`                  |

`resolveLocator` — `|>` shorthand, split per piece:

| Syntax                             | Result                                  |
|------------------------------------|-----------------------------------------|
| `button`                           | `locator('button')`                     |
| `:"Text"`                          | `getByText('Text')`                     |
| `"Text"`                           | `filter({ hasText: 'Text' })`           |
| `:button"Save"`                    | `getByRole('button', { name: 'Save' })` |
| `:~label`                          | `getByLabel('label')`                   |
| `div.form       \|> :button"Save"` | chained in order                        |

`*` inside text/role/label becomes a case-insensitive regex (`"*abc*"` → `/^.*abc.*$/i`).

## Errors

`MatcherError` (`message` with ANSI red/green Expected/Received, `received`, `expected`) for assertions; `ShotMatchError` (`diffName`, `diffResult`, `diffCount`) for screenshots. Helpers: `toRedText`, `toGreenText`, `makeExpectedError(received, expected)`.

## Commands

| Script            | Action                                                                               |
|-------------------|--------------------------------------------------------------------------------------|
| `npm test`        | jest, `src/**/*.test.js`                                                             |
| `npm run example` | `npx playwright test`, `examples/*.uitest.js` (chromium, headless:false, 5s timeout) |
| `npm run report`  | open Playwright HTML report                                                          |
| `npm run build`   | babel `src` → `dist`, excluding `*.test.js`                                          |

Screenshot updates: `cross-env NODE_MODE=update npx playwright test` (docs only — no code reads `NODE_MODE`; pass `updateShot`/`saveCurrent` instead).

## Caveats

1. Eager execution: steps start immediately. Always `await` the runner (or the last link) — a rejected chain is otherwise an unhandled rejection.
2. `page.networkListener` is **not** auto-attached. `listenNetwork`/`matchRequest`/`matchResponse` throw without it.
3. `matchRequest`/`matchResponse` also read `page.requests`, which `PageNetworkListener` never defines (it uses `this.requests`) — these two methods currently fail in practice.
4. `waitForFunction` calls itself recursively instead of `page.waitForFunction` — will stack-overflow.
5. `saveShot(sel?)` calls `expectToBeDefined(selector, target)`, so it throws when `selector` is omitted despite being optional.
6. `clone()` is defined inside the constructor (instance, not prototype) — do not call it as `PageRunner.prototype.clone`.
7. `dist/` is stale relative to `src/` (version 1.3.18); rebuild before publishing.
8. `src/tools/screenshotReporter.js` is legacy Jasmine-era code, unused by the runner.

## Conventions

ES modules, camelCase functions/variables, PascalCase classes, 2-space indent, single quotes, semicolons, ESLint flat config (`eslint.config.js`, preset `eslint-presets`). Imports sorted by `simple-import-sort`. No comments added to generated code.
