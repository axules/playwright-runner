"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.PageRunner = void 0;
var _test = require("@playwright/test");
var _fs = _interopRequireDefault(require("fs"));
var _diffImages = require("./tools/diffImages");
var _makeExpectedError = require("./tools/makeExpectedError");
var _MatcherError = _interopRequireDefault(require("./tools/MatcherError"));
var _ShotMatchError = _interopRequireDefault(require("./tools/ShotMatchError"));
var _utils = require("./tools/utils");
var _resolveCssLocator = require("./tools/resolveCssLocator");
var _lodash = _interopRequireDefault(require("lodash.isstring"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function expectToBeDefined(name, received) {
  if (typeof received === 'undefined') {
    throw new _MatcherError.default(`${(0, _makeExpectedError.toRedText)(name)} Should be defined`, 'undefined', 'any');
  }
  return true;
}
function expectToBe(name, received, expected) {
  if (received !== expected) {
    throw new _MatcherError.default((0, _makeExpectedError.toRedText)(name), received, expected);
  }
  return true;
}
function expectNetworkListener(page) {
  if (!page.networkListener) {
    throw new _MatcherError.default(`${(0, _makeExpectedError.toRedText)(page.networkListener)} is undefined.\nUse ${(0, _makeExpectedError.toGreenText)('page.networkListener = new PageNetworkListener(page)')} after open this page`, 'undefined', 'PageNetworkListener object');
  }
  return true;
}
function expectNetworkListenerIsActive(page) {
  expectNetworkListener(page);
  if (!page.networkListener.active) {
    throw new _MatcherError.default(`networkListener is not active.\nUse ${(0, _makeExpectedError.toGreenText)('toListenNetwork()')} before action that should send request to activate listening.\n And ${(0, _makeExpectedError.toGreenText)('toStopListenNetwork()')} after checking`, 'page.networkListener.active=false', 'page.networkListener.active=true');
  }
  return true;
}
class PageRunner {
  /**
   * Creates a new PageRunner instance (factory method).
   *
   * @param {...any} args - Arguments forwarded to the constructor.
   * @returns {PageRunner} A new PageRunner instance.
   */
  static create(...args) {
    return new this(...args);
  }

  /**
   * Constructs a PageRunner instance.
   *
   * Accepts either a Playwright Page (automatically wraps it with `page.locator('html')`)
   * or a Playwright Locator as the initial locator.
   * Initializes the internal state: action queue, locator stack, debug logger.
   *
   * @param {import("playwright").Page|import("playwright").Locator} initialLocator - Page or Locator to start from.
   * @param {{ debug?: boolean }} [options={}] - Configuration options.
   * @param {boolean} [options.debug=false] - Enables debug logging with timestamps.
   * @throws {Error} If initialLocator is not provided.
   */
  constructor(initialLocator, options = {}) {
    if (!initialLocator) {
      throw new Error('Initial locator should be defined');
    }
    const locator = (0, _utils.isPage)(initialLocator) ? initialLocator.locator('html') : initialLocator;
    this.init = () => {
      const {
        debug = false
      } = options;
      this.runCallerCounter = 0;
      this.locatorsWay = [locator];
      this._page = (0, _utils.getPage)(locator);
      // initNetworkListener(this._page);

      // this.targetTimeout = targetTimeout;
      // this.updateShot = updateShot;
      // this.screenshotTool = screenshotTool;
      this.actionsPull = [];
      this.debug = debug || false;
      if (this.debug) {
        // eslint-disable-next-line no-console
        this.log = (...args) => console.log(new Date().toISOString().replace('T', ' ').slice(10, 23), ...args);
      }
    };
    this.init();
    this.log('New runner created', locator, options);
  }

  /**
   * Wraps an action function with error enrichment and debug logging.
   *
   * On failure, augments the error with the method name, current locator,
   * and original stack trace for easier debugging.
   *
   * @param {Function} caller - Reference to the calling method (used for naming and stack trace).
   * @param {Function} action - Async function implementing the step logic.
   * @param {Error} initError - Error object capturing the initial stack trace.
   * @returns {Function} Wrapped async function that logs and enriches errors.
   * @protected
   */
  _createMatcher(caller, action, initError) {
    return async (...args) => {
      const counter = `          ${this.runCallerCounter++}`.slice(-10);
      // if (typeof global.expect !== 'undefined') {
      //   global.expect.getState().assertionCalls += 1;
      // }
      try {
        this.log(`Action ${counter}:`, caller.name);
        return await action(...args);
      } catch (error) {
        this.log(`Action ${counter} [`, caller.name, '] failed');
        error.stack = initError.stack;
        error.message = ['', `Method: ${initError.message}`, `Current locator: ${this.currentLocator}`, 'Message:', error.message, error.stack].join('\n');
        throw error;
      } finally {
        this.log(`Action ${counter} [`, caller.name, '] finished');
      }
    };
  }

  /**
   * Appends a step to the action queue (this.actionsPull).
   *
   * Wraps the nextAction in a matcher for error handling and logging.
   * Steps are chained sequentially: each step waits for the previous one to resolve.
   * Returns `this` to enable fluent API chaining.
   *
   * @param {Function} caller - Reference to the calling method (used for error context and logging).
   * @param {Function} nextAction - Async function implementing the step's logic.
   * @returns {this} PageRunner instance for method chaining.
   * @throws {Error} If caller is not provided.
   * @protected
   */
  _pushAction(caller, nextAction) {
    if (!caller) throw new Error('Caller is undefined!');
    const initError = new Error(caller.name);
    Error.captureStackTrace(initError, caller);
    const nextMatcher = this._createMatcher(caller, nextAction, initError);
    if (this.actionsPull.length > 0) {
      const last = this.actionsPull[this.actionsPull.length - 1];
      // this.actionsPull.push(last.then(() => Promise.resolve(nextAction())));
      this.actionsPull.push(last.then(nextMatcher));
    } else {
      this.actionsPull.push(Promise.resolve(nextMatcher()));
    }
    return this;
  }

  /**
   * Placeholder log function. Replaced by a console-based logger when `debug: true`.
   * Intentionally does nothing by default.
   */
  log() {}

  /**
   * Initializes internal state. Called automatically from the constructor.
   * Can be overridden or called again to reset state.
   */
  init() {}

  /**
   * Returns the current Playwright Locator (top of the locator stack).
   *
   * @returns {import("playwright").Locator}
   */
  get currentLocator() {
    return this.locatorsWay[this.locatorsWay.length - 1];
  }

  /**
   * Returns the current Playwright Page extracted from the current locator.
   *
   * @returns {import("playwright").Page}
   */
  get currentPage() {
    this._page = this._page || (0, _utils.getPage)(this.currentLocator);
    return this._page;
  }

  /**
   * Returns the current page URL as a URL object.
   *
   * @returns {URL}
   */
  get currentUrl() {
    return new URL(this.currentPage.url());
  }

  /**
   * Resolves a CSS selector string using the `:@method(arg)` syntax
   * against the current page.
   *
   * @param {string} locator - CSS selector with optional `:@method(arg)` directives.
   * @returns {import("playwright").Locator}
   */
  resolveLocator(locator) {
    return (0, _resolveCssLocator.resolveCssLocator)(this.currentPage, locator);
  }

  /**
   * Resolves a selector against either the current locator or the page root,
   * returning a Playwright Locator.
   *
   * - If `locatorOrSelector` is omitted, returns the current locator as-is.
   * - If `locatorOrSelector` starts with `'body'`, resolution starts from
   *   `this.currentPage` (page root) rather than `this.currentLocator`.
   * - Otherwise, resolution starts from `this.currentLocator`.
   *
   * Accepts all selector formats supported by {@link resolveCssLocator}:
   * plain CSS strings (with optional `:@method(arg)` directives), arrays of
   * mixed strings and custom method descriptors, or raw Playwright Locators.
   *
   * @param {import("playwright").Locator|string|Array<string|{method: string, arg: string, node: string|null}>} [locatorOrSelector] -
   *   Optional selector or Locator. Supports `:@method(arg)` syntax.
   * @returns {import("playwright").Locator} The resolved Playwright Locator,
   *   or the current locator if no selector is given.
   *
   * @example
   * runner.within('div > div > div');
   * // returns the current locator unchanged: 'div > div > div'
   * runner.find();
   *
   * @example
   * runner.within('div > div > div');
   * // resolves against the current locator: 'div > div > div button:@text(Submit)'
   * runner.find('button:@text(Submit)');
   *
   * @example
   * runner.within('div > div > div');
   * // resolves from the page root (because starts with 'body'): 'body > .header'
   * runner.find('body > .header');
   */
  find(locatorOrSelector = undefined) {
    const parentLocator = (0, _lodash.default)(locatorOrSelector) && locatorOrSelector.startsWith('body') ? this.currentPage : this.currentLocator;
    return locatorOrSelector ? (0, _resolveCssLocator.resolveCssLocator)(parentLocator, locatorOrSelector) : parentLocator;
  }

  /**
   * Internal helper: waits for the specified timeout in milliseconds.
   *
   * @param {number} timeout - Timeout in milliseconds.
   * @returns {Promise<void>}
   * @protected
   */
  async _waitTime(timeout) {
    if (timeout > 0) {
      await new Promise(resolve => setTimeout(resolve, timeout));
    }
  }

  /**
   * Enables await on the PageRunner instance (Thenable interface).
   * Waits for all queued actions to finish before resolving.
   *
   * @param {Function} onFulfilled - Success callback.
   * @param {Function} onRejected - Error callback.
   * @returns {Promise<void>}
   */
  async then(onFulfilled, onRejected) {
    try {
      if (this.actionsPull.length > 0) {
        await this.actionsPull[this.actionsPull.length - 1].catch();
        this.log('Pull is finished');
      }
      onFulfilled();
    } catch (error) {
      onRejected(error);
    }
  }

  /**
   * Executes an arbitrary user function as a step in the chain.
   *
   * @param {function({runner: PageRunner, page: import("playwright").Page, expect: import('@playwright/test').Expect}): (Promise<void>|void)} func -
   *   Async or sync function receiving an object with `runner` and `page`.
   * @returns {this} PageRunner instance for further chaining.
   * @example
   * await PageRunner.create(page)
   *   .act(({ runner, page }) => {
   *     await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
   *   })
   *   .seeElement('.footer');
   */
  act(func) {
    return this._pushAction(this.act, async () => {
      await func({
        runner: this,
        page: this.currentPage,
        expect: _test.expect
      });
    });
  }

  /**
   * Pauses execution and opens Playwright's built-in debug panel.
   * Useful for interactive debugging during test development.
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  pause() {
    return this._pushAction(this.pause, async () => {
      await this.currentPage.pause();
    });
  }

  /**
   * Pauses execution for the specified timeout.
   * NOT recommended for production tests; prefer deterministic waits.
   *
   * @param {number} [timeout=500] - Timeout in milliseconds.
   * @returns {this} PageRunner instance for further chaining.
   */
  waitTime(timeout = 500) {
    return this._pushAction(this.waitTime, async () => {
      await this._waitTime(timeout);
    });
  }

  /**
   * Triggers an action, then waits for a specific network request to complete.
   *
   * @param {Function} triggerFn - Async function that triggers the request.
   * @param {Function|string|RegExp} checkRequest - Playwright-compatible request matcher.
   * @returns {this} PageRunner instance for further chaining.
   */
  waitForRequestAfterTrigger(triggerFn, checkRequest) {
    return this._pushAction(this.waitForRequestAfterTrigger, async () => {
      // https://playwright.dev/docs/api/class-page#page-wait-for-request
      const requestToWait = this.currentPage.waitForRequest(checkRequest);
      await triggerFn();
      await requestToWait;
    });
  }

  /**
   * Waits for the given function to return a truthy value.
   * Delegates to Playwright's `page.waitForFunction`.
   *
   * @param {Function|string} callback - Function or string expression to evaluate.
   * @returns {this} PageRunner instance for further chaining.
   */
  waitForFunction(callback) {
    return this._pushAction(this.waitForFunction, async () => {
      // https://playwright.dev/docs/api/class-page#page-wait-for-function
      await this.waitForFunction(callback);
    });
  }

  /**
   * Moves back N steps in the locator stack.
   * If stepsNumber exceeds the stack depth, resets to the initial locator.
   *
   * @param {number} [stepsNumber=1] - Number of steps to go back.
   * @returns {this} PageRunner instance for further chaining.
   */
  withinBack(stepsNumber = 1) {
    return this._pushAction(this.withinBack, async () => {
      if (stepsNumber >= this.locatorsWay.length) {
        if (this.locatorsWay.length > 1) {
          console.warn('withinBack :: not enough steps');
        }
        this.locatorsWay = this.locatorsWay.slice(0, 1);
      } else {
        this.locatorsWay = this.locatorsWay.slice(0, this.locatorsWay.length - 1);
      }
    });
  }

  /**
   * Pushes a new locator onto the locator stack, scoping subsequent actions
   * to the element matched by the selector.
   *
   * @param {string} selector - CSS selector (supports `:@method(arg)` syntax).
   * @returns {this} PageRunner instance for further chaining.
   */
  within(selector) {
    return this._pushAction(this.within, async () => {
      this.locatorsWay.push(this.resolveLocator(selector));
    });
  }

  /**
   * Switches the current locator context to the `body` element.
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  withinBody() {
    return this._pushAction(this.withinBody, async () => {
      this.locatorsWay.push(this.resolveLocator('body'));
    });
  }

  /**
   * Pushes a new locator resolved as a child of the current locator.
   * Supports shorthand `|>` selector syntax via `find()`.
   *
   * @param {string} selector - Child selector (supports shorthand syntax).
   * @returns {this} PageRunner instance for further chaining.
   */
  withinChild(selector) {
    return this._pushAction(this.withinChild, async () => {
      this.log(this.currentLocator, '->', selector);
      this.locatorsWay.push(this.find(selector));
    });
  }

  /**
   * Resets the locator stack to the initial locator.
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  withinInitial() {
    return this._pushAction(this.withinInitial, async () => {
      this.locatorsWay = this.locatorsWay.slice(0, 1);
    });
  }

  /**
   * Logs the current locator to the console (for debugging).
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  sayWhere() {
    return this._pushAction(this.sayWhere, async () => {
      // eslint-disable-next-line no-console
      console.log('I am here: ', this.currentLocator);
    });
  }

  /**
   * Logs the full locator stack path to the console (for debugging).
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  sayFullPath() {
    return this._pushAction(this.sayFullPath, async () => {
      // eslint-disable-next-line no-console
      console.log(`I was here:\n${this.locatorsWay.join('\n')}`);
    });
  }

  /**
   * Asserts that an element is visible on the page.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  seeElement(selector = undefined) {
    return this._pushAction(this.seeElement, async () => {
      await (0, _test.expect)(this.find(selector)).toBeVisible();
    });
  }

  /**
   * Asserts that an element is hidden on the page.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  dontSeeElement(selector = undefined) {
    return this._pushAction(this.dontSeeElement, async () => {
      await (0, _test.expect)(this.find(selector)).toBeHidden();
    });
  }

  /**
   * Asserts that a set of elements has an expected count.
   *
   * @param {number} count - Expected number of matching elements.
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectElementsNumber(count, selector = undefined) {
    return this._pushAction(this.expectElementsNumber, async () => {
      await (0, _test.expect)(this.find(selector)).toHaveCount(count);
    });
  }

  /**
   * Asserts that an element is enabled.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectEnabled(selector = undefined) {
    return this._pushAction(this.expectEnabled, async () => {
      await (0, _test.expect)(this.find(selector)).toBeEnabled();
    });
  }

  /**
   * Asserts that an element is disabled.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectDisabled(selector = undefined) {
    return this._pushAction(this.expectDisabled, async () => {
      await (0, _test.expect)(this.find(selector)).toBeDisabled();
    });
  }

  /**
   * Asserts that an element is visible. Alias for `seeElement`.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectVisible(selector = undefined) {
    return this._pushAction(this.expectVisible, async () => {
      await (0, _test.expect)(this.find(selector)).toBeVisible();
    });
  }

  /**
   * Asserts that an element is hidden. Alias for `dontSeeElement`.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectHidden(selector = undefined) {
    return this._pushAction(this.expectHidden, async () => {
      await (0, _test.expect)(this.find(selector)).toBeHidden();
    });
  }

  /**
   * Asserts that an element has the expected CSS styles.
   *
   * @param {Object<string, string>} styles - Map of CSS property names to expected values (e.g., `{ display: 'flex' }`).
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectStyles(styles, selector = undefined) {
    return this._pushAction(this.expectStyles, async () => {
      const target = this.find(selector);
      await (0, _utils.promiseFlow)(Object.entries(styles).map(([key, value]) => (0, _test.expect)(target).toHaveCSS(key, value)));
      // const expectedCss = styles.map(el => el.split(':')).reduce((R, [k, v]) => Object.assign(R, { [k.trim()]: v.trim() }), {});
      // const currentCss = await getStyles(target, Object.keys(expectedCss));
      // const result = Object.entries(expectedCss)
      //   .reduce((R, [key, expected]) => {
      //     const current = currentCss[key];
      //     if (expected instanceof RegExp ? !current.match(expected) : current != expected) {
      //       R.push([key, current, expected]);
      //     }
      //     return R;
      //   }, []);
      // if (result.length > 0) {
      //   const received = [];
      //   const expected = [];
      //   result.forEach(([k, r, e], i) => {
      //     received.push(`${i + 1}. ${k}: ${r};`);
      //     expected.push(`${i + 1}. ${k}: ${e};`);
      //   });
      //   expectToBe(`${selector} Styles:`, received.join('\n'), expected.join('\n'));
      // }
    });
  }

  /**
   * Asserts that an element has the expected attributes.
   *
   * @param {Object<string, string|RegExp>} attr - Map of attribute names to expected values.
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectAttributes(attr, selector = undefined) {
    return this._pushAction(this.expectAttributes, async () => {
      const target = this.find(selector);
      await (0, _utils.promiseFlow)(Object.entries(attr).map(([key, value]) => (0, _test.expect)(target).toHaveAttribute(key, value)));
      // const currentAttr = await getAttributes(target, Object.keys(attr));
      // const result = Object.entries(attr)
      //   .reduce((R, [key, expected]) => {
      //     const current = currentAttr[key];
      //     if (expected instanceof RegExp ? !current.match(expected) : current != expected) {
      //       R.push([key, current, expected]);
      //     }
      //     return R;
      //   }, []);
      // if (result.length > 0) {
      //   const received = [];
      //   const expected = [];
      //   result.forEach(([k, r, e], i) => {
      //     received.push(`${i + 1}. ${k}=${r}`);
      //     expected.push(`${i + 1}. ${k}=${e}`);
      //   });
      //   expectToBe(`${selector} Attributes:`, received.join('\n'), expected.join('\n'));
      // }
    });
  }

  /**
   * Clicks an element.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @param {import("playwright").LocatorClickOptions} [options] - Playwright click options.
   * @returns {this} PageRunner instance for further chaining.
   */
  click(selector = undefined, options = undefined) {
    return this._pushAction(this.click, async () => {
      await this.find(selector).click(options);
    });
  }

  /**
   * Fills an input field with the specified text.
   *
   * @param {string} selector - CSS selector for the input element.
   * @param {string} text - Text to fill into the input.
   * @param {import("playwright").LocatorFillOptions} [options] - Playwright fill options.
   * @returns {this} PageRunner instance for further chaining.
   */
  fill(selector, text, options = undefined) {
    return this._pushAction(this.fill, async () => {
      await this.find(selector).fill(text, options);
    });
  }

  /**
   * Fills a form by mapping field `[name]` attributes to values.
   * For each entry in data, finds the input by `[name="key"]` and fills or clears it.
   *
   * @param {Object<string, string|null>} data - Map of field names to values. Falsy values clear the field.
   * @param {string} [parent] - Optional parent selector to scope the form fields.
   * @returns {this} PageRunner instance for further chaining.
   */
  fillForm(data, parent) {
    return this._pushAction(this.fillForm, async () => {
      const form = this.find(parent);
      await (0, _utils.promiseFlow)(Object.entries(data).map(([name, value]) => async () => {
        const inputSelector = `[name="${name}"]`;
        const field = await form.locator(inputSelector);
        if (value) {
          await field.fill(String(value));
        } else {
          await field.clear();
        }
      }));
    });
  }

  /**
   * Internal helper: presses one or more keys on an optional target element or the page keyboard.
   *
   * @param {string|string[]} key - Key or array of keys to press sequentially.
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {Promise<void>}
   * @protected
   */
  async _pressKey(key, element = undefined) {
    const target = element && this.find(element);
    const {
      keyboard
    } = this.currentPage;
    await (0, _utils.promiseFlow)((Array.isArray(key) ? key : [key]).map(el => (target || keyboard).press(el)));
  }

  /**
   * Presses one or more keys on an optional target element or the page keyboard.
   *
   * @param {string|string[]} key - Key or array of keys to press sequentially.
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {this} PageRunner instance for further chaining.
   */
  pressKey(key, element = undefined) {
    return this._pushAction(this.pressKey, async () => {
      await this._pressKey(key, element);
    });
  }

  /**
   * Presses the Enter key on an optional target element or the page keyboard.
   *
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {this} PageRunner instance for further chaining.
   */
  pressEnter(element = undefined) {
    return this._pushAction(this.pressKey, async () => {
      await this._pressKey('Enter', element);
    });
  }

  /**
   * Presses the Escape key on an optional target element or the page keyboard.
   *
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {this} PageRunner instance for further chaining.
   */
  pressEsc(element = undefined) {
    return this._pushAction(this.pressKey, async () => {
      await this._pressKey('Escape', element);
    });
  }

  /**
   * Presses the Tab key on an optional target element or the page keyboard.
   *
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {this} PageRunner instance for further chaining.
   */
  pressTab(element = undefined) {
    return this._pushAction(this.pressKey, async () => {
      await this._pressKey('Tab', element);
    });
  }

  /**
   * Presses the Space key on an optional target element or the page keyboard.
   *
   * @param {string} [element] - Optional CSS selector for the target element.
   * @returns {this} PageRunner instance for further chaining.
   */
  pressSpace(element = undefined) {
    return this._pushAction(this.pressKey, async () => {
      await this._pressKey('Space', element);
    });
  }

  /**
   * Asserts that an element contains the expected text.
   *
   * @param {string|RegExp} text - Expected text content (or regex pattern).
   * @param {string} [element] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectText(text, element = undefined) {
    return this._pushAction(this.expectText, async () => {
      await (0, _test.expect)(this.find(element)).toContainText(text);
    });
  }

  /**
   * Asserts that an element has the exact expected text.
   *
   * @param {string|RegExp} text - Expected exact text content (or regex pattern).
   * @param {string} [element] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectExactText(text, element = undefined) {
    return this._pushAction(this.expectExactText, async () => {
      await (0, _test.expect)(this.find(element)).toHaveText(text);
    });
  }

  /**
   * Asserts that an input field has the expected value.
   *
   * @param {string} field - CSS selector for the input element.
   * @param {string} value - Expected input value.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectValue(field, value) {
    return this._pushAction(this.expectValue, async () => {
      await (0, _test.expect)(this.find(field)).toHaveValue(value);
      // const targetValue = await target.evaluate(el => el.value);
      // if (!matchString(targetValue, value, strict)) {
      //   expectToBe(field, targetValue, strict ? value : `contains '${value}'`);
      // }
    });
  }

  /**
   * Asserts that the current page URL matches the given URL or pattern.
   * Supports wildcard prefixes: `* /` matches same-origin paths, `** /` matches any URL ending with the path.
   *
   * @param {string|RegExp} urlOrPath - URL string, RegExp, or wildcard pattern (`* /path` or `** /path`).
   * @returns {this} PageRunner instance for further chaining.
   */
  hasUrl(urlOrPath) {
    return this._pushAction(this.hasUrl, async () => {
      if ((0, _lodash.default)(urlOrPath) && urlOrPath.startsWith('*/')) {
        await (0, _test.expect)(this.currentPage).toHaveURL(this.currentUrl.origin + urlOrPath.slice(1));
      } else if ((0, _lodash.default)(urlOrPath) && urlOrPath.startsWith('**/')) {
        await (0, _test.expect)(this.currentPage).toHaveURL(new RegExp(`.+${urlOrPath.slice(2)}`));
      } else {
        await (0, _test.expect)(this.currentPage).toHaveURL(urlOrPath);
      }
    });
  }

  /**
   * Asserts that the current page URL contains the expected query parameters.
   *
   * @param {Object<string, string>} expectedParams - Map of query parameter names to expected values.
   * @returns {this} PageRunner instance for further chaining.
   */
  hasQueryParams(expectedParams) {
    return this._pushAction(this.hasQueryParams, async () => {
      const errors = [];
      try {
        await (0, _test.expect)(this.currentPage).toHaveURL(url => {
          const params = url.searchParams;
          Object.entries(expectedParams).forEach(([key, val]) => {
            if (String(params[key]) !== String(val)) {
              errors.push(`Param: ${key};\nExpected: ${val};\nActual: ${val}`);
            }
          }, []);
          return errors.length === 0;
        });
      } catch (e) {
        console.error(e.message);
        const error = new Error(errors.join('\n'));
        error.cause = e;
        throw error;
      }
    });
  }

  /**
   * Logs a custom text message to the console during chain execution.
   *
   * @param {string} text - The message to display.
   * @returns {this} PageRunner instance for further chaining.
   */
  say(text) {
    return this._pushAction(this.say, async () => {
      // eslint-disable-next-line no-console
      console.info(text);
    });
  }

  /**
   * Navigates the page to the specified URL.
   * Optionally waits for a selector to be visible after navigation.
   *
   * @param {string} url - The URL to navigate to.
   * @param {string} [waitForSelector] - Optional selector to wait for after navigation.
   * @param {import("playwright").PageGotoOptions} [options] - Playwright goto options (merged with `{ waitUntil: 'load' }`).
   * @returns {this} PageRunner instance for further chaining.
   */
  goto(url, waitForSelector = undefined, options = undefined) {
    return this._pushAction(this.goto, async () => {
      await this.currentPage.goto(url, {
        waitUntil: 'load',
        ...options
      });
      if (waitForSelector) {
        await (0, _test.expect)(this.currentPage.locator(waitForSelector)).toBeVisible();
      }
    });
  }

  /**
   * Reloads the current page.
   * Optionally waits for a selector to be visible after reload.
   *
   * @param {string} [waitForSelector] - Optional selector to wait for after reload.
   * @param {import("playwright").PageReloadOptions} [options] - Playwright reload options.
   * @returns {this} PageRunner instance for further chaining.
   */
  reloadPage(waitForSelector = undefined, options = undefined) {
    return this._pushAction(this.reloadPage, async () => {
      const {
        currentPage
      } = this;
      await currentPage.reload({
        waitUntil: 'load',
        ...options
      });
      if (waitForSelector) {
        await (0, _test.expect)(this.find(waitForSelector)).toBeVisible();
      }
    });
  }

  /**
   * Clears an input field.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  clear(selector = undefined) {
    return this._pushAction(this.clear, async () => {
      await this.find(selector).clear();
    });
  }

  /**
   * Selects option values in a `<select>` element.
   *
   * @param {string} selector - CSS selector for the `<select>` element.
   * @param {string|string[]|import("playwright").SelectOptionValues} values - Value(s) to select.
   * @returns {this} PageRunner instance for further chaining.
   */
  select(selector, values) {
    return this._pushAction(this.select, async () => {
      await this.find(selector).selectOption(values);
    });
  }

  /**
   * Focuses on an element.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  focus(selector = undefined) {
    return this._pushAction(this.focus, async () => {
      await this.find(selector).focus();
    });
  }

  /**
   * Removes focus from an element (blur).
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  blur(selector = undefined) {
    return this._pushAction(this.blur, async () => {
      await this.find(selector).blur();
    });
  }

  /**
   * Drags an element to a target element.
   *
   * @param {string} selector - CSS selector for the element to drag.
   * @param {string} target - CSS selector for the drop target.
   * @param {import("playwright").LocatorDragToOptions} [options] - Playwright drag-to options.
   * @returns {this} PageRunner instance for further chaining.
   */
  dragTo(selector, target, options = undefined) {
    return this._pushAction(this.dragTo, async () => {
      // https://playwright.dev/docs/api/class-locator#locator-drag-to
      await this.find(selector || undefined).dragTo(this.find(target), options);
    });
  }

  /**
   * Performs a drop action on an element with the given payload.
   *
   * @param {string} selector - CSS selector for the drop target element.
   * @param {import("playwright").LocatorDropPayload} payload - Data to drop.
   * @param {import("playwright").LocatorDropOptions} [options] - Playwright drop options.
   * @returns {this} PageRunner instance for further chaining.
   */
  drop(selector, payload, options = undefined) {
    return this._pushAction(this.drop, async () => {
      // https://playwright.dev/docs/api/class-locator#locator-drop
      await this.find(selector || undefined).drop(payload, options);
    });
  }

  /**
   * Highlights an element in the browser (Playwright debug feature).
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  highlight(selector = undefined) {
    return this._pushAction(this.highlight, async () => {
      // https://playwright.dev/docs/api/class-locator#locator-highlight
      await this.find(selector).highlight();
    });
  }

  /**
   * Removes the highlight from an element.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  highlightOff(selector = undefined) {
    return this._pushAction(this.highlightOff, async () => {
      // https://playwright.dev/docs/api/class-locator#locator-hide-highlight
      await this.find(selector).hideHighlight();
    });
  }

  /**
   * Hovers over an element.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @returns {this} PageRunner instance for further chaining.
   */
  hover(selector = undefined) {
    return this._pushAction(this.hover, async () => {
      await this.find(selector).hover();
    });
  }

  /**
   * Uploads file(s) to a file input element.
   *
   * @param {string} selector - CSS selector for the file input element.
   * @param {string|string[]} files - File path or array of file paths to upload.
   * @returns {this} PageRunner instance for further chaining.
   */
  uploadFile(selector, files) {
    return this._pushAction(this.uploadFile, async () => {
      await this.find(selector).setInputFiles(Array.isArray(files) ? files : [files]);
    });
  }

  /**
   * Scrolls an element into view if it is not already visible.
   *
   * @param {string} [selector] - Optional CSS selector. Uses current locator if omitted.
   * @param {import("playwright").LocatorScrollIntoViewIfNeededOptions} [options] - Playwright scroll options.
   * @returns {this} PageRunner instance for further chaining.
   */
  scrollIntoViewIfNeeded(selector = undefined, options = undefined) {
    return this._pushAction(this.scrollIntoViewIfNeeded, async () => {
      await this.find(selector).scrollIntoViewIfNeeded(options);
    });
  }

  /**
   * Takes a screenshot of the specified element and saves it.
   *
   * @param {string} selector - CSS selector for the element to screenshot (required).
   * @param {string} name - Screenshot name / filename.
   * @returns {this} PageRunner instance for further chaining.
   */
  saveShot(selector, name) {
    return this._pushAction(this.saveShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this.find(selector);
      }
      expectToBeDefined(selector, target);
      await this.screenshotTool(target, name);
      // await target.dispose();
    });
  }

  /**
   * Takes a full-page screenshot and saves it.
   *
   * @param {string} name - Screenshot name / filename.
   * @returns {this} PageRunner instance for further chaining.
   */
  savePageShot(name) {
    return this._pushAction(this.savePageShot, async () => {
      await this.screenshotTool(this.currentPage, {
        name,
        fullPage: true
      });
    });
  }

  /**
   * Compares an element's current screenshot with a reference image.
   * Saves the screenshot if no reference exists, or if `saveCurrent` or `updateShot` is set.
   * Throws a ShotMatchError if pixel differences exceed the threshold.
   *
   * @param {string} selector - CSS selector for the element (required if not using current locator).
   * @param {string} name - Screenshot name / filename.
   * @param {boolean} [saveCurrent=false] - Force save the screenshot even if a reference exists.
   * @returns {this} PageRunner instance for further chaining.
   * @throws {ShotMatchError} If the screenshot does not match the reference.
   */
  matchShot(selector, name, saveCurrent = false) {
    return this._pushAction(this.matchShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this.find(selector);
      }
      expectToBeDefined(selector, target);
      const fullName = this.screenshotTool?.getFullName(name);
      const isExists = fullName && _fs.default.existsSync(fullName);
      const save = saveCurrent || this.updateShot || !isExists;
      const current = await this.screenshotTool(target, {
        name,
        save,
        returnBuffer: !save
      });
      if (save) {
        // eslint-disable-next-line no-console
        console.log('Save shot: ', current);
      } else {
        const {
          count,
          diff
        } = (0, _diffImages.diffImages)(fullName, current);
        if (count > 0) {
          throw new _ShotMatchError.default(this.screenshotTool.getCurrentName(name), count, diff);
        }
      }
    });
  }

  /**
   * Starts recording network requests/responses for the current page.
   * Requires `page.networkListener` to be initialized.
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  listenNetwork() {
    return this._pushAction(this.listenNetwork, async () => {
      const page = this.currentPage;
      expectNetworkListener(page);
      page.networkListener.startListen();
    });
  }

  /**
   * Stops recording network requests/responses.
   *
   * @returns {this} PageRunner instance for further chaining.
   */
  stopListenNetwork() {
    return this._pushAction(this.stopListenNetwork, async () => {
      const page = this.currentPage;
      expectNetworkListener(page);
      page.networkListener.stopListen();
    });
  }

  /**
   * Finds a network request by URL pattern and passes it to a matcher function.
   * Must be called between `listenNetwork()` and `stopListenNetwork()`.
   *
   * @param {string|RegExp} url - URL or pattern to match.
   * @param {function(import("playwright").Request): Promise<void>|void} matcher -
   *   Async function that receives the matched Playwright Request object.
   * @param {number} [timeout=2000] - Timeout in milliseconds to wait for the request.
   * @returns {this} PageRunner instance for further chaining.
   */
  matchRequest(url, matcher, timeout = 2000) {
    return this._pushAction(this.matchRequest, async () => {
      const page = this.currentPage;
      expectNetworkListenerIsActive(page);
      const isOk = (await page.requests.findRequests(url).length) > 0;
      if (!isOk) {
        expectToBe(`${url}\nRequest is sent for ${timeout / 1000}s`, 'false', 'true');
      }
      const request = page.requests.findRequests(url).pop();
      await matcher(request.request());
    });
  }

  /**
   * Finds a network response by URL pattern and passes it to a matcher function.
   * Must be called between `listenNetwork()` and `stopListenNetwork()`.
   *
   * @param {string|RegExp} url - URL or pattern to match.
   * @param {function(import("playwright").Response): Promise<void>|void} matcher -
   *   Async function that receives the matched Playwright Response object.
   * @param {number} [timeout=10000] - Timeout in milliseconds to wait for the response.
   * @returns {this} PageRunner instance for further chaining.
   */
  matchResponse(url, matcher, timeout = 10000) {
    return this._pushAction(this.matchResponse, async () => {
      const page = this.currentPage;
      expectNetworkListenerIsActive(page);
      const isOk = (await page.requests.findRequests(url, true).length) > 0;
      if (!isOk) {
        expectToBe(`${url}\nRequest is finished for ${timeout / 1000}s`, 'false', 'true');
      }
      const request = page.requests.findRequests(url, true).pop();
      await matcher(request.response());
    });
  }

  /**
   * Returns the Playwright APIRequestContext for the current page.
   * Useful for making HTTP requests relative to the page's origin.
   *
   * @returns {import("playwright").APIRequestContext}
   */
  get apiContext() {
    return this.currentPage.request;
  }

  /**
   * Resolves a potentially relative URL against the current page's origin.
   *
   * - Absolute URLs (`http(s)://...`) are returned as-is.
   * - Root-relative URLs (`/path`) are prefixed with the current origin.
   * - Relative URLs are prefixed with the current origin + pathname.
   *
   * @param {string} url - The URL to enhance.
   * @returns {string} The fully qualified URL.
   * @protected
   */
  _enhanceUrl(url) {
    if (/^https?:\/\//i.test(url)) return url;
    const {
      currentUrl
    } = this;
    if (url.startsWith('/')) return `${currentUrl.origin}${url}`;
    return `${currentUrl.origin}${currentUrl.pathname}/${url}`;
  }

  /**
   * Makes an HTTP fetch request relative to the current page's origin.
   *
   * @param {string} url - URL (absolute, root-relative, or relative).
   * @param {import("playwright").APIRequestContextOptions} [options={}] - Fetch options.
   * @returns {Promise<import("playwright").APIResponse>}
   */
  async fetch(url, options = {}) {
    const fullUrl = this._enhanceUrl(url);
    this.log('fetch', fullUrl);
    return this.apiContext.fetch(fullUrl, options);
  }

  /**
   * Fetches a URL and asserts the response status and/or body.
   *
   * @param {string} url - URL to fetch (absolute or relative).
   * @param {import("playwright").APIRequestContextOptions} options - Fetch options.
   * @param {{ status?: number, data?: string|Object }} expected -
   *   Expected response: `{ status: 200, data: '...' }` or `{ status: 200, data: { ... } }`.
   * @returns {this} PageRunner instance for further chaining.
   */
  expectFetch(url, options, expected) {
    return this._pushAction(this.expectFetch, async () => {
      const result = await this.fetch(url, options);
      if (expected.status) {
        (0, _test.expect)(result.status()).toBe(expected.status || expected);
      }
      if (expected.data) {
        if ((0, _lodash.default)(expected.data)) {
          const data = await result.text();
          (0, _test.expect)(data).toBe(expected.data);
        } else {
          const data = await result.json();
          (0, _test.expect)(data).toEqual(expected.data);
        }
      }
    });
  }
}
exports.PageRunner = PageRunner;