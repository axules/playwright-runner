import { expect } from '@playwright/test';
import fs from 'fs';

import { diffImages } from './tools/diffImages';
import {
  toGreenText,
  toRedText,
} from './tools/makeExpectedError';
import MatcherError from './tools/MatcherError';
import PageNetworkListener from './tools/PageNetworkListener';
import ShotMatchError from './tools/ShotMatchError';
import {
  getPage,
  isPage,
  promiseFlow,
  selectElement,
  selectElements,
} from './tools/utils';
import { resolveCssLocator } from './tools/resolveCssLocator';
import isString from 'lodash.isstring';


function expectToBeDefined(name, received) {
  if (typeof received === 'undefined') {
    throw new MatcherError(`${toRedText(name)} Should be defined`, 'undefined', 'any');
  }
  return true;
}

function expectToBe(name, received, expected) {
  if (received !== expected) {
    throw new MatcherError(toRedText(name), received, expected);
  }
  return true;
}

function expectNetworkListener(page) {
  if (!page.networkListener) {
    throw new MatcherError(
      `${toRedText(page.networkListener)} is undefined.\nUse ${toGreenText('page.networkListener = new PageNetworkListener(page)')} after open this page`,
      'undefined',
      'PageNetworkListener object',
    );
  }
  return true;
}

function expectNetworkListenerIsActive(page) {
  expectNetworkListener(page);
  if (!page.networkListener.active) {
    throw new MatcherError(
      `networkListener is not active.\nUse ${toGreenText('toListenNetwork()')} before action that should send request to activate listening.\n And ${toGreenText('toStopListenNetwork()')} after checking`,
      'page.networkListener.active=false',
      'page.networkListener.active=true',
    );
  }
  return true;
}

function initNetworkListener(page) {
  if (!page.networkListener) {
    page.networkListener = new PageNetworkListener(page);
  }
}

function defaultScreenshotMaster() {
  throw new Error('You should put "screenshot tool" as additional option');
}

export class PageRunner {
  static create(...args) {
    return new this(...args);
  }

  constructor(initialLocator, options = {}) {
    if (!initialLocator) {
      throw new Error('Initial locator should be defined');
    }
    const locator = isPage(initialLocator) ? initialLocator.locator('body') : initialLocator;

    this.init = () => {
      const {
        debug = false,
        updateShot = false,
        screenshotTool = defaultScreenshotMaster,
        targetTimeout = 2500,
      } = options;

      this.runCallerCounter = 0;
      this.locatorsWay = [locator];
      this._page = getPage(locator);
      initNetworkListener(this._page);

      this.targetTimeout = targetTimeout;
      this.updateShot = updateShot;
      this.screenshotTool = screenshotTool;
      this.pull = [];
      this.debug = debug || false;
      if (this.debug) {
        // eslint-disable-next-line no-console
        this.log = (...args) => console.log(
          new Date().toISOString()
            .replace('T', ' ')
            .slice(10, 23),
          ...args,
        );
      }

      this._disabled.not = (selector) => this._disabled(selector, true);
      this._checked.not = (selector) => this._checked(selector, true);
      this._has.not = (selectors) => this._has(selectors, true);
    };

    this.init();
    this.log('New runner created', locator, options);
  }

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
        error.message = [
          '',
          `Method: ${initError.message}`,
          `Current locator: ${this.currentLocator}`,
          'Message:',
          error.message,
          error.stack,
        ].join('\n');
        throw error;
      } finally {
        this.log(`Action ${counter} [`, caller.name, '] finished');
      }
    };
  }

  /**
   * Добавляет шаг в очередь выполнения (this.pull).
   * Оборачивает nextAction в matcher для обработки ошибок и логирования.
   * Возвращает this для поддержки цепочечного вызова (fluent API).
   *
   * @param {Function} caller - Ссылка на вызывающий метод (используется для
   *   генерации контекста ошибки и логирования имени шага).
   * @param {Function} nextAction - Асинхронная функция, реализующая логику шага.
   * @returns {this} Экземпляр PageRunner для chaining.
   * @throws {Error} Если caller не передан (undefined).
   * @protected
   */
  _then(caller, nextAction) {
    if (!caller) throw new Error('Caller is undefined!');
    const initError = new Error(caller.name);
    Error.captureStackTrace(initError, caller);
    const nextMatcher = this._createMatcher(caller, nextAction, initError);
    if (this.pull.length > 0) {
      const last = this.pull[this.pull.length - 1];
      // this.pull.push(last.then(() => Promise.resolve(nextAction())));
      this.pull.push(last.then(nextMatcher));
    } else {
      this.pull.push(Promise.resolve(nextMatcher()));
    }

    return this;
  }

  log() {}
  init() {}

  /**
   * Use to get current Playwright Locator
   *
   * @returns {import("playwright").Locator}
   */
  get currentLocator() {
    return this.locatorsWay[this.locatorsWay.length - 1];
  }

  /**
   * Use to get current Playwright Page
   *
   * @returns {playwright.Page}
   */
  get currentPage() {
    return this._page;
  }

  get currentUrl() {
    return new URL(this.currentPage.url());
  }

  /**
   * Find children locator or current if selector is empty
   *
   * @arg {import("playwright").Locator|String?} locatorOrSelector
   * @returns {import("playwright").Locator}
   */
  find(locatorOrSelector = undefined) {
    return locatorOrSelector ? resolveCssLocator(this.currentLocator, locatorOrSelector) : this.currentLocator;
  }

  _waitForNavigation(options) {
    return this.currentPage.waitForNavigation(options);
  }

  _getTarget(selectors) {
    const isBody = typeof (selectors) === 'string' && /^body/i.test(selectors);
    return selectElement(isBody ? this.currentPage : this.currentLocator, selectors);
  }

  _getTargets(selectors) {
    const isBody = typeof (selectors) === 'string' && /^body/i.test(selectors);
    return selectElements(isBody ? this.currentPage : this.currentLocator, selectors);
  }

  async _disabled(selector, not = false) {
    const target = await this._getTarget(selector);
    expectToBeDefined(selector, target);
    const value = await target._page.evaluate(el => el.disabled, target);
    expectToBe('disabled', value || false, !not);
  }

  async _checked(selector, not = false) {
    const target = await this._getTarget(selector);
    expectToBeDefined(selector, target);
    const value = await target._page.evaluate(el => el.checked, target);
    expectToBe('checked', value, !not);
  }

  async _has(selectors, not = false) {
    const count = not ? 0 : 1;
    await Promise.all(
      (Array.isArray(selectors)
        ? selectors.map(el => (Array.isArray(el) ? [el[0], el[1], el[2]] : [el, count]))
        : (
          typeof (selectors) === 'string'
            ? [[selectors, count]]
            : Object.entries(selectors).map(([selector, value]) => {
              const [minCount, maxCount] = Array.isArray(value) ? value : [value, undefined];
              return [selector, minCount, maxCount];
            })
        )
      ).map(async ([selector, countMin, countMax]) => {
        const elements = await this._getTargets(selector);
        if (countMax === undefined) {
          expectToBe(String(selector), elements.length, countMin);
        } else if (elements.length < countMin || elements.length > countMax) {
          expectToBe(String(selector), elements.length, `between ${countMin} and ${countMax}`);
        }
      }),
    );
  }

  _wait(any, options = {}) {
    if (!any) return null;

    switch (typeof any) {
      case 'number': return this._waitTime(any, options);
      case 'function': return this._waitPromise(any, options);
      case 'string': return this._waitForTarget(any, options);
      default:
        if (any.then && any.reject) {
          return this._waitPromise(any, options);
        } else {
          return this._waitForTarget(any, options);
        }
    }
  }

  async _waitPromise(fn, options = {}) {
    const { polling = 200, timeout = 15000 } = options;
    const page = this.currentPage;
    let waited = 0;
    while (!(await fn()) && waited <= timeout) {
      waited += polling;
      await page.waitFor(polling);
    }
    return waited <= timeout;
  }

  async _waitForTarget(locatorOrSelector, options = {}) {
    let element = undefined;
    await this._waitPromise(
      async () => {
        element = await this._getTarget(locatorOrSelector);
        return !!element;
      },
      { timeout: this.targetTimeout, ...options },
    );
    expectToBeDefined(locatorOrSelector, element);
    return element;
  }

  async _waitTime(timeout) {
    if (timeout > 0) {
      await this.currentPage.waitFor(timeout);
    }
  }

  async run() {
    if (this.pull.length > 0) {
      await this.pull[this.pull.length - 1];
      this.log('Pull is finished');
    }
    return this;
  }

  pause() {
    return this._then(this.pause, async () => {
      await this.currentPage.pause();
    });
  }

  waitTime(timeout = 5000) {
    return this._then(this.waitTime, async () => {
      await this._waitTime(timeout);
    });
  }

  waitForNavigation(selector = undefined, timeout = 15000) {
    this._then(this.waitForNavigation, async () => {
      await this._waitForNavigation();
      if (selector) {
        await this._waitForTarget(selector, { timeout });
      }
    });
    return this;
  }

  waitForRequest(options = {}) {
    const { minCount = 0, ...restOptions } = options;

    this._then(this.waitForRequest, async () => {
      await this._waitPromise(
        async () => {
          const page = this.currentPage;
          expectNetworkListener(page);
          return page.networkListener?.activeRequests <= minCount;
        },
        { timeout: 10000, ...restOptions },
      );
    });
    return this;
  }

  withinBack(stepsNumber = 1) {
    return this._then(this.withinBack, async () => {
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

  within(selector) {
    return this._then(this.within, async () => {
      this.locatorsWay.push(this.currentPage.locator(selector));
    });
  }

  withinBody() {
    return this._then(this.withinBody, async () => {
      this.locatorsWay.push(this.currentPage.locator('body'));
    });
  }

  withinChild(selector) {
    return this._then(this.withinChild, async () => {
      this.log(this.currentLocator, '->', selector);
      this.locatorsWay.push(this.currentLocator.locator(selector));
    });
  }

  withinInitial() {
    return this._then(this.withinInitial, async () => {
      this.locatorsWay = this.locatorsWay.slice(0, 1);
    });
  }

  where() {
    return this._then(this.where, async () => {
      // eslint-disable-next-line no-console
      console.log('I am here: ', this.currentLocator);
    });
  }

  fullWay() {
    return this._then(this.fullWay, async () => {
      // eslint-disable-next-line no-console
      console.log('I was here: ', this.locatorsWay.join(' -->> '));
    });
  }

  seeElement(selector = undefined) {
    return this._then(this.seeElement, async () => {
      await expect(this.find(selector)).toBeVisible();
    });
  }

  dontSeeElement(selector = undefined) {
    return this._then(this.dontSeeElement, async () => {
      await expect(this.find(selector)).toBeHidden();
    });
  }

  seeElementsNumber(count, selector = undefined) {
    return this._then(this.seeElementsNumber, async () => {
      await expect(this.find(selector)).toHaveCount(count);
    });
  }

  enabled(selector = undefined) {
    return this._then(this.enabled, async () => {
      await expect(this.find(selector)).toBeEnabled();
    });
  }

  disabled(selector = undefined) {
    return this._then(this.disabled, async () => {
      await expect(this.find(selector)).toBeDisabled();
    });
  }

  visible(selector = undefined) {
    return this._then(this.visible, async () => {
      await expect(this.find(selector)).toBeVisible();
    });
  }

  hidden(selector = undefined) {
    return this._then(this.hidden, async () => {
      await expect(this.find(selector)).toBeHidden();
    });
  }

  matchStyles(styles, selector = undefined) {
    return this._then(this.matchStyles, async () => {
      const target = this.find(selector);
      await promiseFlow(Object.entries(styles).map(([key, value]) => expect(target).toHaveCSS(key, value)));
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

  matchAttr(attr, selector = undefined) {
    return this._then(this.matchAttr, async () => {
      const target = this.find(selector);
      await promiseFlow(Object.entries(attr).map(([key, value]) => expect(target).toHaveAttribute(key, value)));
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

  click(selector = undefined, options = undefined) {
    return this._then(this.click, async () => {
      await this.find(selector).click(options);
    });
  }

  fill(selector, text, options = undefined) {
    return this._then(this.fill, async () => {
      await this.find(selector).fill(text, options);
    });
  }

  fillForm(data, parent) {
    return this._then(this.fillForm, async () => {
      const form = this.find(parent);

      await promiseFlow(
        Object.entries(data).map(([name, value]) => async () => {
          const inputSelector = `[name="${name}"]`;
          const field = await form.locator(inputSelector);
          if (value) {
            await field.fill(String(value));
          } else {
            await field.clear();
          }
        }),
      );
    });
  }

  async _pressKey(key, element = undefined) {
    const target = element && this.find(element);
    const { keyboard } = this.currentPage;
    await promiseFlow((Array.isArray(key) ? key : [key]).map((el) => (target || keyboard).press(el)));
  }

  pressKey(key, element = undefined) {
    return this._then(this.pressKey, async () => {
      await this._pressKey(key, element);
    });
  }

  pressEnter(element = undefined) {
    return this._then(this.pressKey, async () => {
      await this._pressKey('Enter', element);
    });
  }

  pressEsc(element = undefined) {
    return this._then(this.pressKey, async () => {
      await this._pressKey('Escape', element);
    });
  }

  pressTab(element = undefined) {
    return this._then(this.pressKey, async () => {
      await this._pressKey('Tab', element);
    });
  }

  pressSpace(element = undefined) {
    return this._then(this.pressKey, async () => {
      await this._pressKey('Space', element);
    });
  }

  seeText(text, element = undefined) {
    return this._then(this.seeText, async () => {
      await expect(this.find(element)).toContainText(text);
    });
  }

  seeExactText(text, element = undefined) {
    return this._then(this.seeExactText, async () => {
      await expect(this.find(element)).toHaveText(text);
    });
  }

  matchValue(field, value) {
    return this._then(this.matchValue, async () => {
      await expect(this.find(field)).toHaveValue(value);
      // const targetValue = await target.evaluate(el => el.value);
      // if (!matchString(targetValue, value, strict)) {
      //   expectToBe(field, targetValue, strict ? value : `contains '${value}'`);
      // }
    });
  }

  hasUrl(urlOrPath) {
    return this._then(this.hasUrl, async () => {
      if (isString(urlOrPath) && urlOrPath.startsWith('*/')) {
        await expect(this.currentPage).toHaveURL(this.currentUrl.origin + urlOrPath.slice(1));
      } else if (isString(urlOrPath) && urlOrPath.startsWith('**/')) {
        await expect(this.currentPage).toHaveURL(new RegExp(`.+${urlOrPath.slice(2)}`));
      } else {
        await expect(this.currentPage).toHaveURL(urlOrPath);
      }
      // let currentPath = '';
      // const isOk = await this._waitPromise(() => {
      //   currentPath = (new URL(this.currentPage.urlOrPath())).pathname;
      //   return matchString(currentPath, urlOrPath, strict);
      // }, { timeout });
      // if (!isOk) {
      //   expectToBe('Current page urlOrPath', currentPath, strict ? urlOrPath : `contains '${urlOrPath}'`);
      // }
    });
  }

  hasQueryParams(expectedParams) {
    return this._then(this.hasQueryParams, async () => {
      const errors = [];
      try {
        await expect(this.currentPage).toHaveURL((url) => {
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

  say(text) {
    return this._then(this.say, async () => {
      // eslint-disable-next-line no-console
      console.info(text);
    });
  }

  goto(url, waitForSelector = undefined, options = undefined) {
    return this._then(this.goto, async () => {
      await this.currentPage.goto(url, { waitUntil: 'load', ...options });
      if (waitForSelector) {
        await expect(this.currentPage.locator(waitForSelector)).toBeVisible();
      }
    });
  }

  reloadPage(waitForSelector = null, options = undefined) {
    return this._then(this.reloadPage, async () => {
      const { currentPage } = this;
      await currentPage.reload({ waitUntil: 'load', ...options });
      if (waitForSelector) {
        await expect(currentPage.locator(waitForSelector)).toBeVisible();
      }
    });
  }

  clear(selector = undefined) {
    return this._then(this.clear, async () => {
      await this.find(selector).clear();
    });
  }

  select(selector, values) {
    return this._then(this.select, async () => {
      await this.find(selector).selectOption(values);
    });
  }

  focus(selector = undefined) {
    return this._then(this.focus, async () => {
      await this.find(selector).focus();
    });
  }

  blur(selector = undefined) {
    return this._then(this.blur, async () => {
      await this.find(selector).blur();
    });
  }

  hover(selector = undefined) {
    return this._then(this.hover, async () => {
      await this.find(selector).hover();
    });
  }

  uploadFile(selector, files) {
    return this._then(this.uploadFile, async () => {
      await this.find(selector).setInputFiles(Array.isArray(files) ? files : [files]);
    });
  }

  saveShot(selector, name) {
    return this._then(this.saveShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this._waitForTarget(selector);
      }
      expectToBeDefined(selector, target);
      await this.screenshotTool(target, name);
      // await target.dispose();
    });
  }

  savePageShot(name) {
    return this._then(this.savePageShot, async () => {
      await this.screenshotTool(this.currentPage, { name, fullPage: true });
    });
  }

  matchShot(selector, name, saveCurrent = false) {
    return this._then(this.matchShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this._waitForTarget(selector);
      }
      expectToBeDefined(selector, target);

      const fullName = this.screenshotTool?.getFullName(name);
      const isExists = fullName && fs.existsSync(fullName);
      const save = saveCurrent || this.updateShot || !isExists;
      const current = await this.screenshotTool(target, { name, save, returnBuffer: !save });

      if (save) {
        // eslint-disable-next-line no-console
        console.log('Save shot: ', current);
      } else {
        const { count, diff } = diffImages(fullName, current);
        if (count > 0) {
          throw new ShotMatchError(this.screenshotTool.getCurrentName(name), count, diff);
        }
      }
    });
  }

  listenNetwork() {
    return this._then(this.listenNetwork, async () => {
      const page = this.currentPage;
      expectNetworkListener(page);
      page.networkListener.startListen();
    });
  }

  stopListenNetwork() {
    return this._then(this.stopListenNetwork, async () => {
      const page = this.currentPage;
      expectNetworkListener(page);
      page.networkListener.stopListen();
    });
  }

  // use listenNetwork() before it and toStopListenNetwork() after
  matchRequest(url, matcher, timeout = 2000) {
    return this._then(this.matchRequest, async () => {
      const page = this.currentPage;
      expectNetworkListenerIsActive(page);
      const isOk = await this._waitPromise(() => page.networkListener.findRequests(url).length > 0, { timeout });
      if (!isOk) {
        expectToBe(`${url}\nRequest is sent for ${timeout / 1000}s`, 'false', 'true');
      }
      const request = page.networkListener.findRequests(url).pop();
      await matcher(request.request());
    });
  }

  matchResponse(url, matcher, timeout = 10000) {
    return this._then(this.matchResponse, async () => {
      const page = this.currentPage;
      expectNetworkListenerIsActive(page);
      const isOk = await this._waitPromise(() => page.networkListener.findRequests(url, true).length > 0, { timeout });
      if (!isOk) {
        expectToBe(`${url}\nRequest is finished for ${timeout / 1000}s`, 'false', 'true');
      }
      const request = page.networkListener.findRequests(url, true).pop();
      await matcher(request.response());
    });
  }
}
