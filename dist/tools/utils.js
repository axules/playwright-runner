"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.clearPath = clearPath;
exports.getAttributes = getAttributes;
exports.getPage = getPage;
exports.getStyles = getStyles;
exports.getYMD = getYMD;
exports.isPage = isPage;
exports.isVisible = isVisible;
exports.matchObject = matchObject;
exports.matchString = matchString;
exports.promiseFlow = promiseFlow;
exports.resolveUrlSearchParams = resolveUrlSearchParams;
exports.selectElement = selectElement;
exports.selectElements = selectElements;
async function selectElement(container, selector) {
  if (selector && selector.$ && selector.$$) return selector;
  if (!selector) return undefined;
  const [nodeSelector, n = 0] = Array.isArray(selector) ? selector : [selector, 0];
  if (nodeSelector[0] == '/') return (await container.$x(nodeSelector))[n];
  return (n > 0 ? (await container.$$(nodeSelector))[n] : await container.$(nodeSelector)) || undefined;
}
async function selectElements(container, selector) {
  if (!selector) return [];
  if (selector && selector.locator && selector.waitFor) {
    return [selector];
  }
  const [nodeSelector, count = 0] = Array.isArray(selector) ? selector : [selector, 0];
  const selectFunc = q => nodeSelector[0] == '/' ? container.locator(selector) : container.$$(q);
  return count > 0 ? (await selectFunc(nodeSelector)).slice(0, count) : selectFunc(nodeSelector);
}
async function getStyleInContent(page, node, selectStyles) {
  const select = (Array.isArray(selectStyles) ? selectStyles : (selectStyles || '').split(',')).map(el => el.trim()).filter(el => el);
  return await page.evaluate((el, select) => {
    const styles = window.getComputedStyle(el);
    if (select.length == 0) return styles;
    return select.reduce((R, key) => {
      R[key] = styles.getPropertyValue(key);
      return R;
    }, {});
  }, node, select);
}
async function getAttributesInContent(node, selectAttr) {
  const select = (Array.isArray(selectAttr) ? selectAttr : (selectAttr || '').split(',')).map(el => el.trim()).filter(el => el);
  return await node.evaluate((el, select) => {
    return select.reduce((R, key) => {
      R[key] = el.getAttribute(key);
      return R;
    }, {});
  }, select);
}
function isPage(element) {
  return element && element.localStorage && element.constructor && ['Page', '_Page'].includes(element.constructor.name);
}
function getPage(element) {
  if (!element) return null;
  if (isPage(element)) return element;
  return element._page || element?._frame?._page;
  // const frame = await(await element.executionContext()).frame();
  // return frame?._frameManager?._page || frame;
}
async function getStyles(node, styles) {
  return getStyleInContent(await getPage(node), node, styles);
}
async function getAttributes(node, attributes) {
  return getAttributesInContent(node, attributes);
}
async function isVisible(elements) {
  async function isVisibleBox(element) {
    // const rect = element.getBoundingClientRect();
    const rect = await element.boundingBox();
    return !!(rect.top || rect.bottom || rect.width || rect.height);
  }
  const elList = Array.isArray(elements) ? elements : [elements];
  const page = await getPage(elList.find(el => !!el));
  return !!page && elList.every(async el => {
    if (!el) return false;
    const style = await getStyleInContent(page, el, 'visibility,opacity');
    return style.visibility !== 'dontSee' && parseFloat(style.opacity || 1) > 0 && (await isVisibleBox(el));
  });
}
function getYMD(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()].map(el => String(el).length >= 2 ? el : `00${el}`.slice(-2)).join('_');
}
function clearPath(str) {
  return str.replace(/[?/\\:<>|"*]/g, '-');
}
function promiseFlow(list = []) {
  if (list.length === 0) return Promise.resolve();
  if (typeof list[0] !== 'function') {
    throw new Error('promiseFlow - list[0] is not function');
  }
  let point = Promise.resolve(list[0]());
  for (let i = 1; i < list.length; i++) {
    if (typeof list[i] !== 'function') {
      throw new Error(`promiseFlow - list[${i}] is not function`);
    }
    point = point.then(list[i]);
  }
  return point;
}
function resolveUrlSearchParams(params) {
  const result = {};
  params.forEach(([k, v]) => {
    if (!result[k]) result[k] = [];
    result[k].push(v);
  });
  Object.entries(result).forEach(([k, v]) => {
    if (!k.includes('[') && v.length === 1) {
      result[k] = v[0];
    }
  });
  return result;
}
function matchString(received, expected, strict = false) {
  return expected instanceof RegExp ? !!received.match(expected) : strict || !expected ? received == expected : received.includes(expected);
}
function matchObject(received, expected, strict = false) {
  const diff = Object.entries(expected).map(el => [el[0], undefined, el[1]]);
  const additional = [];
  Object.entries(received).forEach(([k, actual]) => {
    const n = diff.findIndex(el => el && el[0] == k);
    if (n >= 0) {
      if (String(diff[n][2]) == String(actual)) diff[n] = null;else diff[n][1] = actual;
    } else {
      additional.push([k, actual, undefined]);
    }
  });
  return diff.concat(strict ? additional : []).filter(el => el);
}