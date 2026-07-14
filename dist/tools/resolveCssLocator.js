"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.parseCssSelector = parseCssSelector;
exports.resolveCssLocator = resolveCssLocator;
exports.resolveCssQuery = resolveCssQuery;
exports.resolveCustomMethod = resolveCustomMethod;
var _lodash = _interopRequireDefault(require("lodash.isstring"));
var _resolveLocator = require("./resolveLocator");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// function findTextRest(str) {
//   let position = 0;
//   let openedBrackets = 1;
//   while (position < str.length && openedBrackets > 0) {
//     const char = str[++position];
//     openedBrackets += (char === ')' && -1) || (char === '(' && 1) || 0;
//   }
//
//   if (openedBrackets > 0) {
//     throw new Error(`Wrong selector part: \`${str}\``);
//   }
//
//   return str.slice(0, position);
// }

/**
 * Parses a CSS selector string, extracting custom `:@method(arg)` directives
 * and separating them from regular CSS parts.
 *
 * Supported custom methods:
 *   - `:@text(Any text)` — match by text content
 *   - `:@role(button)` — match by ARIA role
 *   - `:@label(any label)` — match by aria-label or associated label
 *   - `:@placeholder(any text)` — match by placeholder attribute
 *   - `:@title(Click here)` — match by title attribute
 *   - `*:@text(Submit)` — filter within the current element by text
 *   - `"quoted arg (with parens)"` — quoted arguments allow parentheses inside
 *
 * @param {string} selector - The CSS selector string, possibly containing `:@method(arg)` calls.
 * @returns {Array<string|{method: string, arg: string, node: string|null}>}
 *   An array of alternating strings (plain CSS parts) and objects (custom method descriptors).
 * @throws {Error} If a custom function is not applied to a valid preceding selector.
 *
 * @example
 * parseCssSelector('button:@text(Submit)')
 * // ['button', { method: 'text', arg: 'Submit', node: null }]
 *
 * @example
 * parseCssSelector('div.form > *:@text(Error)')
 * // ['div.form >', { method: 'text', arg: 'Error', node: '*' }]
 *
 * @example
 * parseCssSelector('a:@title(Click here)')
 * // ['a', { method: 'title', arg: 'Click here', node: null }]
 *
 * @example
 * parseCssSelector('div:@text("Submit (123)")')
 * // ['div', { method: 'text', arg: 'Submit (123)', node: null }]
 */
function parseCssSelector(selector) {
  // Ignored CSS without special rules
  if (!selector.includes(':@')) return [selector];

  // if (selector.includes(',')) {
  //   throw new Error('Not supported combined selectors (e.g. "div.submit, div.newOne")');
  // }

  const pieces = [];
  let execResult;
  let cursor = 0;
  // e.g. :@text(Any text), :@role(button), :@label(any label), :@placeholder(any text)
  const customMethodsRegexp = /(>?\s?[*])??:@([a-z\d]+)\((\s*"(.+?)"\s*|([^)(]+?))\)/gi;
  while (execResult = customMethodsRegexp.exec(selector)) {
    const [, node, method,, arg, argFallback] = execResult;
    if (!node && /\s/.test(selector[execResult.index - 1])) {
      throw new Error('Custom functions should be applied to another selector. E.g. `*:text(Submit)` OR `input[type="radio"]:title(Option 1)`');
    }
    pieces.push(selector.slice(cursor, execResult.index).trim());
    pieces.push({
      method,
      arg: arg ?? argFallback,
      node
    });
    cursor = customMethodsRegexp.lastIndex;
  }
  pieces.push(selector.slice(cursor).trim());
  return pieces.filter(it => {
    if (/:@/.test(it)) throw new Error(`Custom function is wrong and was not parsed: ${it}`);
    return !!it;
  });
}

/**
 * Resolves a custom method descriptor (parsed by {@link parseCssSelector}) into
 * a Playwright locator method call tuple `[methodName, ...args]`.
 *
 * Supported methods: `text`, `label`, `role`, `placeholder`, `title`.
 * If a `node` is present (e.g. `*:@text(...)`), the `text` method returns
 * `getByText` to locate child elements; otherwise it returns `filter({ hasText })`
 * to narrow the current locator by text content.
 *
 * @param {{ method: string, arg: string, node: string|null }} customMethod -
 *   The custom method descriptor object.
 * @returns {[string, ...*]} A tuple where the first element is the Playwright
 *   locator method name, and the rest are arguments to that method.
 * @throws {Error} If the method name is unknown.
 *
 * @example
 * resolveCustomMethod({ method: 'text', arg: 'Submit', node: null })
 * // ['filter', { hasText: 'Submit' }]
 *
 * @example
 * resolveCustomMethod({ method: 'text', arg: 'Error', node: '*' })
 * // ['getByText', /Error/i]
 *
 * @example
 * resolveCustomMethod({ method: 'role', arg: 'button', node: null })
 * // ['getByRole', 'button']
 */
function resolveCustomMethod(customMethod) {
  const {
    method,
    arg,
    node
  } = customMethod;
  const isFind = !!node;
  switch (method.toLowerCase()) {
    case 'text':
      return isFind ? ['getByText', (0, _resolveLocator.resolveText)(arg)] : ['filter', {
        hasText: (0, _resolveLocator.resolveText)(arg)
      }];
    case 'label':
      return ['getByLabel', (0, _resolveLocator.resolveText)(arg)];
    case 'role':
      return ['getByRole', (0, _resolveLocator.resolveText)(arg)];
    case 'placeholder':
      return ['getByPlaceholder', (0, _resolveLocator.resolveText)(arg)];
    case 'title':
      return ['getByTitle', (0, _resolveLocator.resolveText)(arg)];
    default:
      throw new Error(`Unknown method ${method}`);
  }
}

/**
 * Resolves a CSS selector value (string or array) into a sequence of Playwright
 * locator method call tuples. Each string is parsed by {@link parseCssSelector},
 * and each custom method descriptor is resolved by {@link resolveCustomMethod}.
 *
 * @param {string|Array<string|{method: string, arg: string, node: string|null}>} value -
 *   A CSS selector string, an array of selector strings and/or custom method objects.
 * @returns {Array<[string, ...*]>} An array of tuples, each representing a Playwright
 *   locator method call: `['locator', cssSelector]` or the result of `resolveCustomMethod`.
 *
 * @example
 * resolveCssQuery('button:@text(Submit)')
 * // [['locator', 'button'], ['filter', { hasText: 'Submit' }]]
 *
 * @example
 * resolveCssQuery(['div.form', { method: 'text', arg: 'Error', node: '*' }])
 * // [['locator', 'div.form'], ['getByText', /Error/i]]
 */
function resolveCssQuery(value) {
  return (Array.isArray(value) ? value : [value]).flatMap(it => (0, _lodash.default)(it) ? parseCssSelector(it.trim()) : [it]).map(it => (0, _lodash.default)(it) ? ['locator', it] : resolveCustomMethod(it));
}

/**
 * Resolves a CSS selector (string or array) against a Playwright parent locator
 * by chaining appropriate locator method calls. This is the main entry point
 * for the module.
 *
 * If `selector` is not a string or array (e.g. already a Locator), it is returned
 * as-is. Otherwise, it is resolved via {@link resolveCssQuery} and each resulting
 * tuple is applied to the parent locator in sequence via `.reduce`.
 *
 * Supported custom CSS methods:
 *   - `:@text(Any text)` — match by text content
 *   - `:@role(button)` — match by ARIA role
 *   - `:@label(any label)` — match by aria-label or associated label
 *   - `:@placeholder(any text)` — match by placeholder attribute
 *   - `:@title(Click here)` — match by title attribute
 *   - `*:@text(Submit)` — filter within the current element by text
 *   - `"quoted arg (with parens)"` — quoted arguments allow parentheses inside
 *
 * @param {import('playwright').Locator|import('playwright').Page} parent - The parent Playwright Locator
 *   to resolve the selector against.
 * @param {string|Array<string|{method: string, arg: string, node: string|null}>|import('playwright').Locator} selector -
 *   A CSS selector string (possibly with `:@method(arg)` directives), an array of
 *   mixed strings and custom method descriptors, or a raw Locator.
 * @returns {import('playwright').Locator} The resolved Playwright Locator.
 *
 * @example
 * resolveCssLocator(page.locator('body'), 'button:@text(Submit)')
 * // page.locator('button').filter({ hasText: 'Submit' })
 *
 * @example
 * resolveCssLocator(page.locator('body'), 'div.form > *:@text(Error)')
 * // page.locator('div.form > *').getByText(/Error/i)
 *
 * @example
 * resolveCssLocator(page.locator('body'), ['div.form', { method: 'text', arg: 'Error', node: '*' }])
 * // page.locator('div.form').getByText(/Error/i)
 *
 * @example
 * resolveCssLocator(page.locator('body'), page.locator('existing'))
 * // page.locator('existing')  — returned as-is
 */
function resolveCssLocator(parent, selector) {
  if (!(0, _lodash.default)(selector) && !Array.isArray(selector)) {
    return selector;
  }
  return resolveCssQuery(selector).reduce((R, [method, ...args]) => R[method](...args), parent);
}