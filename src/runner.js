import fs from 'fs';
import {expect, test} from "@playwright/test";
import {
  selectElement,
  selectElements,
  getPage,
  getStyles,
  isVisible,
  getAttributes,
  promiseFlow,
  resolveUrlSearchParams,
  matchString,
  matchObject, isPage
} from './tools/utils';
import ShotMatchError from './tools/ShotMatchError';
import MatcherError from './tools/MatcherError';
import { toRedText, toGreenText } from './tools/makeExpectedError';
import PageNetworkListener from './tools/PageNetworkListener';
import { diffImages } from './tools/diffImages';
import {resolveLocator} from "./tools/resolveLocator";


export function newRunner(pageOrLocator, config = {}) {
  if (!pageOrLocator) {
    throw new Error('Initial locator should be defined');
  }
  return new AsyncRunner(
    isPage(pageOrLocator) ? pageOrLocator.locator('body') : pageOrLocator,
    {
      updateShot: process.env.NODE_MODE == 'update',
      ...config
    }
  );
}

function createMatcher(action, initError) {
  return async function throwingMatcher(...args) {
    // if (typeof global.expect !== 'undefined') {
    //   global.expect.getState().assertionCalls += 1;
    // }
    try {
      return await action(...args);
    } catch (error) {
      error.stack = initError.stack;
      error.message = `\n${initError.message}\n${error.message}\n`;
      throw error;
    }
  };
}

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
      'PageNetworkListener object'
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
      'page.networkListener.active=true'
    );
  }
  return true;
}

function initNetworkListener(page) {
  if (!page.networkListener) {
    page.networkListener = new PageNetworkListener(page);
  }
}

export class AsyncRunner {
  constructor(initialLocator, options = {}) {
    const {
      debug = false,
      updateShot = false,
      screenshoter = defaultScreenshoter,
      targetTimeout = 2500,
    } = options;

    this.locatorsWay = [initialLocator];
    this.page = getPage(initialLocator);
    initNetworkListener(this.page);

    this.targetTimeout = targetTimeout;
    this.updateShot = updateShot;
    this.screenshoter = screenshoter;
    this.pull = [];
    this.log = debug ? console.log : () => null;
    this.debug = debug || false;

    this._disabled.not = (selector) => this._disabled(selector, true);
    this._checked.not = (selector) => this._checked(selector, true);
    this._has.not = (selectors) => this._has(selectors, true);
  }

  _setContainer(node) {
  }

  async _changeContainer(page, selector) {
    const nodeSelector = typeof selector === 'string' ? selector : 'body';
    const newContainer = await selectElement(page, nodeSelector);
    this._setContainer(newContainer || page);
  }

  _then(caller, nextAction) {
    if (!caller) throw new Error('Caller is undefined!');
    const initError = new Error(caller.name);
    Error.captureStackTrace(initError, caller);
    const nextMatcher = createMatcher(nextAction, initError);
    if (this.pull.length > 0) {
      const last = this.pull[this.pull.length - 1];
      // this.pull.push(last.then(() => Promise.resolve(nextAction())));
      this.pull.push(last.then(nextMatcher));
    } else {
      this.pull.push(Promise.resolve(nextMatcher()));
    }

    if (this.debug) {
      const last = this.pull[this.pull.length - 1];
      last.then(() => this.log(`${caller.name} is finished`));
      last.catch((error) => {
        console.error(caller.name);
        return Promise.reject(error);
      });
    }

    return this;
  }

  get currentLocator() {
    return this.locatorsWay[this.locatorsWay.length - 1];
  }

  get currentPage() {
    return this.page;
  }

  get currentUrl() {
    return new URL(this.currentPage.url());
  }

  find(locatorOrSelector) {
    return resolveLocator(this.currentLocator, locatorOrSelector);
  }

  _waitForNavigation(options) {
    return this.currentPage.waitForNavigation(options);
  }

  _getTarget(selector) {
    const isBody = typeof(selectors) == 'string' && /^body/i.test(selector);
    return selectElement(isBody ? this.currentPage : this.currentLocator, selector);
  }

  _getTargets(selector) {
    const isBody = typeof(selectors) == 'string' && /^body/i.test(selector);
    return selectElements(isBody ? this.currentPage : this.currentLocator, selector);
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
          typeof(selectors) == 'string'
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
      })
    );
  }

  _wait(any, options = {}) {
    if (!any) return null;

    switch (typeof any) {
      case 'number': return this._waitTime(any, options);
      case 'function': return this._waitPromise(any, options);
      case 'string': return this._waitTarget(any, options);
      default:
        if (any.then && any.reject) {
          return this._waitPromise(any, options);
        } else {
          return this._waitTarget(any, options);
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

  async _waitTarget(locatorOrSelector, options = {}) {
    let element = undefined;
    await this._waitPromise(
      async () => {
        element = await this._getTarget(locatorOrSelector);
        return !!element;
      },
      { timeout: this.targetTimeout, ...options }
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
      await this.pull[this.pull.length - 1].then(
        () => this.log('Pull is finished'),
        // (error) => console.error('Pull is failed', error),
      );
    }
    return this;
  }

  pause() {
    return this._then(this.hasNo, async () => {
      await this.currentPage.pause();
    });
  }

  hasNo(selectors) {
    return this._then(this.hasNo, async () => {
      await this._has.not(selectors);
    });
  }

  has(selectors) {
    return this._then(this.has, async () => {
      await this._has(selectors);
    });
  }

  // appear(selector, timeout = 5000) {
  //   return this._then(this.appear, async () => {
  //     await this._waitTarget(selector, { timeout });
  //   });
  // }
  //
  // disappear(selector, timeout = 5000) {
  //   if (!selector) return this;
  //   return this._then(this.disappear, async () => {
  //     await this._waitPromise(
  //       async () => !(await this._getTarget(selector)),
  //       { timeout }
  //     );
  //   });
  // }

  // toWait(selector, options = {}) {
  //   return this._then(this.toWait, async () => {
  //     await this._waitTarget(selector, { timeout: 30000, ...options });
  //   });
  // }

  waitTime(timeout = 5000) {
    return this._then(this.waitTime, async () => {
      await this._waitTime(timeout);
    });
  }

  waitNavigation(selector = undefined, timeout = 15000) {
    this._then(this.waitNavigation, async () => {
      await this._waitForNavigation();
      if (selector) {
        await this._waitTarget(selector, { timeout });
      }
    });
    return this;
  }

  waitRequest(options = {}) {
    const { minCount = 0, ...restOptions } = options;

    this._then(this.waitRequest, async () => {
      await this._waitPromise(
        async () => {
          const page = this.currentPage;
          expectNetworkListener(page);
          return page.networkListener?.activeRequests <= minCount;
        },
        { timeout: 10000, ...restOptions }
      );
    });
    return this;
  }

  moveBack(stepsNumber = 1) {
    return this._then(this.moveBack, async () => {
      if (stepsNumber >= this.locatorsWay.length) {
        if (this.locatorsWay.length > 1) {
          console.warn(`moveBack :: not enough steps`);
        }
        this.locatorsWay = this.locatorsWay.slice(0, 1);
      } else {
        this.locatorsWay = this.locatorsWay.slice(0, this.locatorsWay.length - 1);
      }
    });
  }

  moveToBody() {
    return this._then(this.moveToBody, async () => {
      this.locatorsWay.push(this.currentPage.locator('body'));
    });
  }

  moveToChild(selector) {
    return this._then(this.moveToChild, async () => {
      this.locatorsWay.push(this.currentLocator.locator(selector));
    });
  }

  moveToInitial() {
    return this._then(this.moveToInitial, async () => {
      this.locatorsWay = this.locatorsWay.slice(0, 1);
    });
  }

  where() {
    return this._then(this.where, async () => {
      console.log(this.currentLocator);
    });
  }

  visible(selector = null) {
    return this._then(this.visible, async () => {
      const target = await this._waitTarget(selector);
      expectToBe('', await isVisible(target), true);
      // await target.dispose();
    });
  }

  hidden(selector = null) {
    return this._then(this.hidden, async () => {
      const target = await this._waitTarget(selector);
      expectToBe(await isVisible(target), false);
      // await target.dispose();
    });
  }

  enabled(selector = null) {
    return this._then(this.enabled, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);
      // await target.dispose();
    });
  }

  disabled(selector = null) {
    return this._then(this.disabled, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled(target);
      // await target.dispose();
    });
  }

  matchStyles(selector, styles) {
    return this._then(this.matchStyles, async () => {
      const target = await this._waitTarget(selector);
      const expectedCss = styles.map(el => el.split(':')).reduce((R, [k, v]) => Object.assign(R, { [k.trim()]: v.trim() }), {});
      const currentCss = await getStyles(target, Object.keys(expectedCss));
      const result = Object.entries(expectedCss).reduce((R, [key, expected]) => {
        const current = currentCss[key];
        if (expected instanceof RegExp ? !current.match(expected) : current != expected) {
          R.push([key, current, expected]);
        }
        return R;
      }, []);
      if (result.length > 0) {
        const received = [];
        const expected = [];
        result.forEach(([k, r, e], i) => {
          received.push(`${i+1}. ${k}: ${r};`);
          expected.push(`${i+1}. ${k}: ${e};`);
        });
        expectToBe(`${selector} Styles:`, received.join('\n'), expected.join('\n'));
      }
    });
  }

  matchAttr(selector, attr) {
    return this._then(this.matchAttr, async () => {
      const target = await this._waitTarget(selector);
      const currentAttr = await getAttributes(target, Object.keys(attr));
      const result = Object.entries(attr).reduce((R, [key, expected]) => {
        const current = currentAttr[key];
        if (expected instanceof RegExp ? !current.match(expected) : current != expected) {
          R.push([key, current, expected]);
        }
        return R;
      }, []);
      if (result.length > 0) {
        const received = [];
        const expected = [];
        result.forEach(([k, r, e], i) => {
          received.push(`${i+1}. ${k}=${r}`);
          expected.push(`${i+1}. ${k}=${e}`);
        });
        expectToBe(`${selector} Attributes:`, received.join('\n'), expected.join('\n'));
      }
    });
  }

  click(selector = undefined, options = undefined) {
    return this._then(this.click, async () => {
      const locator = selector ? this.find(selector) : this.currentLocator;
      await expect(locator).toBeEnabled();
      await locator.click(options);
    });
  }

  fill(selector, text, options = undefined) {
    return this._then(this.fill, async () => {
      const locator = selector ? this.find(selector) : this.currentLocator;
      await expect(locator).toBeEnabled();
      await locator.fill(text, options);
    });
  }

  fillForm(selector, data) {
    return this._then(this.fillForm, async () => {
      const form = await this._waitTarget(selector);
      await this._disabled.not(form);

      await promiseFlow(
        Object.entries(data).map(([name, value]) => async () => {
          const inputSelector = `[name="${name}"]`;
          const fields = Array.from(await selectElements(form, inputSelector));
          if (fields.length === 0) {
            expectToBe(`${inputSelector} should be found in ${selector}`, fields.length, ' > 0');
          }
          return promiseFlow(
            fields.map((field, i) => async () => {
              await field.click({ clickCount: 3 });
              const fieldValue = (value?.then && value?.reject) || typeof value === 'function'
                ? (await value(name, i, field))
                : value;
              await field.type(String(fieldValue));
            })
          );
        })
      );
    });
  }

  press(selector, button, options) {
    return this._then(this.press, async () => {
      const target = await this._waitTarget(selector, options);
      await this._disabled.not(target);
      await promiseFlow(
        (Array.isArray(button) ? button : [button]).map((el) => () => target.press(el))
      );
    });
  }

  containsText(text) {
    return this._then(this.containsText, async () => {
      await test.expect(this.currentLocator).toContainText(text);
    });
  }

  hasText(text) {
    return this._then(this.hasText, async () => {
      await test.expect(this.currentLocator).toHaveText(text);
    });
  }

  matchValue(selector, value, strict = false) {
    return this._then(this.matchValue, async () => {
      const target = await this._waitTarget(selector);
      const targetValue = await target.evaluate(el => el.value);
      if (!matchString(targetValue, value, strict)) {
        expectToBe(selector, targetValue, strict ? value : `contains '${value}'`);
      }
    });
  }

  hasUrl(urlOrPath) {
    return this._then(this.hasUrl, async () => {
      if (urlOrPath.startsWith('*/')) {
        await expect(this.currentPage).toHaveURL(this.currentUrl.origin + urlOrPath.slice(1));
      } else if (urlOrPath.startsWith('**/')) {
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

  hasQueryParams(expectedParams, strict = false) {
    return this._then(this.hasQueryParams, async () => {
      throw new Error('IMPLEMENT IT');
      let result = [];
      await this._waitPromise(() => {
        const currentParams = resolveUrlSearchParams(Array.from(this.currentUrl.searchParams));
        result = matchObject(currentParams, expectedParams, strict)
          .map(([k, r, e]) => [`${k}=${r}`, `${k}=${e}`]);
        return result.length == 0;
      });

      if (result.length) {
        expectToBe(
          new URL(this.currentPage.url()).search,
          result.map(el => el[0]).join(',\n'),
          result.map(el => el[1]).join(',\n'),
        );
      }
    });
  }

  goto(url, waitForSelector = undefined, timeout = undefined) {
    return this._then(this.goto, async () => {
      const { currentPage } = this;
      const fullUrl = (/^https?:\/\//i.test(url) ? '' : this.currentUrl.origin) + url;
      await currentPage.goto(fullUrl, { timeout, waitUntil: 'networkidle0' });
      if (waitForSelector) {
        await expect(currentPage.locator(waitForSelector)).toBeVisible();
      }
    });
  }

  reloadPage(waitForLocator = null, timeout = 5000) {
    return this._then(this.reloadPage, async () => {
      const page = this.currentPage;
      await page.reload({ timeout, waitUntil: ['load', 'networkidle0'] });
      if (waitForLocator) {
        await this._wait(waitForLocator, { timeout });
      }
    });
  }

  clear(selector) {
    return this._then(this.clear, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);

      await target.click({ clickCount: 3 });
      await target.press('Backspace');
      // await target.dispose();
    });
  }

  select(selector, values) {
    return this._then(this.select, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);
      await target.select(...(Array.isArray(values) ? values : [values]));
      // await target.dispose();
    });
  }

  focus(selector) {
    return this._then(this.focus, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);
      await target.focus();
      // await target.dispose();
    });
  }

  blur() {
    return this._then(this.blur, async () => {
      await this.currentPage.evaluate(() => window.document.activeElement.blur());
    });
  }

  hover(selector) {
    return this._then(this.hover, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);
      await target.hover();
      // await target.dispose();
    });
  }

  uploadFile(selector, files) {
    return this._then(this.uploadFile, async () => {
      const target = await this._waitTarget(selector);
      await this._disabled.not(target);
      await target.uploadFile(...(Array.isArray(files) ? files : [files]));
      // await target.dispose();
    });
  }

  saveShot(selector, name) {
    return this._then(this.saveShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this._waitTarget(selector);
      }
      expectToBeDefined(selector, target);
      await this.screenshoter(target, name);
      // await target.dispose();
    });
  }

  savePageShot(name) {
    return this._then(this.savePageShot, async () => {
      await this.screenshoter(this.currentPage, { name, fullPage: true });
    });
  }

  matchShot(selector, name, saveCurrent = false) {
    return this._then(this.matchShot, async () => {
      let target = this.currentLocator;
      if (selector) {
        target = await this._waitTarget(selector);
      }
      expectToBeDefined(selector, target);

      const fullName = this.screenshoter?.getFullName(name);
      const isExists = fullName && fs.existsSync(fullName);
      const save = saveCurrent || this.updateShot || !isExists;
      const current = await this.screenshoter(target, { name, save, returnBuffer: !save });

      if (save) {
        console.log('Save shot: ', current);
      } else {
        const { count, diff } = diffImages(fullName, current);
        if (count > 0) {
          throw new ShotMatchError(this.screenshoter.getCurrentName(name), count, diff);
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

function defaultScreenshoter() {
  throw new Error('You should put "screenshoter" as additional option');
}