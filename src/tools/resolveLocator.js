import isString from 'lodash.isstring';

/**
 * Resolves a text string, converting wildcard patterns (*) into a RegExp.
 *
 * Shorthand syntax reference:
 *   :button"button text"     → getByRole('button', { name: "button text" })
 *   :button"*button text*"   → getByRole('button', { name: /button text/i })
 *   :"*button text*"         → getByText(/button text/i)
 *   :~*button text*          → getByLabel(/button text/i)
 *
 * @param {string} text - The text to resolve. May contain `*` wildcards.
 * @returns {string|RegExp} - The original string if no wildcards found,
 *                            otherwise a case-insensitive RegExp sayWhere `*`
 *                            is replaced with `.*`.
 *
 * @example
 * resolveText('Submit')        // 'Submit'
 * resolveText('*Submit*')      // /^.*Submit.*$/i
 * resolveText('*Submit')       // /^.*Submit$/i
 * resolveText('Submit*')       // /^Submit.*$/i
 */
export function resolveText(text) {
  if (text.includes('*')) {
    return new RegExp(`^${text.replaceAll('*', '.*')}$`, 'i');
  }
  return text;
}

/**
 * Resolves a single shorthand locator piece into a Playwright locator
 * method call tuple.
 *
 * Supported shorthand patterns:
 *   :"text"        → getByText('text')
 *   "text"         → getByText('text')  (alias without colon)
 *   :~label        → getByLabel('label')
 *   :role"text"    → getByRole('role', { name: 'text' })
 *   css-selector   → locator('css-selector')  (fallback for anything else)
 *
 * Wildcard `*` in text/label/role creates a case-insensitive RegExp.
 *
 * @param {string} locatorPiece - A single shorthand locator piece (no `|>` chaining).
 * @returns {[string, ...*]} - A tuple sayWhere the first element is the Playwright
 *                             method name, and the rest are its arguments.
 *
 * @example
 * resolveQueryPiece(':"Submit"')          // ['getByText', 'Submit']
 * resolveQueryPiece('"Submit"')           // ['filter', { hasText: 'Submit' }]
 * resolveQueryPiece(':~Email')            // ['getByLabel', 'Email']
 * resolveQueryPiece(':button"OK"')        // ['getByRole', 'button', { name: 'OK' }]
 * resolveQueryPiece('div.container')      // ['locator', 'div.container']
 */
export function resolveQueryPiece(locatorPiece) {
  if (locatorPiece.startsWith(':"')) {
    const [, text] = locatorPiece.match(/:"([^[\]].+)"/);
    return ['getByText', resolveText(text)];
  } else if (locatorPiece.startsWith('"')) {
    const [, text] = locatorPiece.match(/"([^[\]].+)"/);
    return ['filter', { hasText: resolveText(text) }];
  } else if (locatorPiece.startsWith(':~')) {
    return ['getByLabel', resolveText(locatorPiece.slice(2))];
  } else if (locatorPiece.startsWith(':')) {
    const [, role, text] = locatorPiece.match(/:(.+)"([^[\]].+)"/);
    return ['getByRole', role, { name: resolveText(text) }];
  }
  return ['locator', locatorPiece];
}

/**
 * Parses a `|>`-separated shorthand selector string (or an array of such
 * strings) into an array of Playwright locator method call tuples.
 *
 * When an array is passed, each element is split by `|>` and all resulting
 * pieces are flattened and resolved in order. This is useful when building
 * selectors programmatically, e.g. via {@link RunnerLocator}.
 *
 * Each piece separated by `|>` is independently resolved via
 * {@link resolveQueryPiece}, and the resulting tuples are returned in order.
 *
 * @param {string|string[]} value - The shorthand selector string(s).
 *        Strings are split by `|>`; arrays have each element split and
 *        flattened.
 * @returns {[string, ...*][]} - An array of method call tuples, each
 *                               suitable for sequential chaining on a
 *                               Playwright Locator.
 *
 * @example
 * resolveQuery('div |> :button"Submit"')
 * // [['locator', 'div'], ['getByRole', 'button', { name: 'Submit' }]]
 *
 * resolveQuery(['div', ':"Text"'])
 * // [['locator', 'div'], ['getByText', 'Text']]
 */
export function resolveQuery(value) {
  const pieces = Array.isArray(value) ? value.flatMap(it => (isString(it) ? it.split('|>') : it)) : value.split('|>');
  return pieces.map(it => isString(it) ? resolveQueryPiece(it.trim()) : it);
}

/**
 * Resolves a shorthand selector string against a parent Playwright Locator,
 * returning the resulting chained Locator.
 *
 * If `selector` is not a string (e.g., already a Locator), it is returned
 * as-is, allowing pass-through of pre-resolved locators.
 *
 * @param {import('playwright').Locator} parent - The parent Playwright
 *        Locator to resolve against.
 * @param {string|import('playwright').Locator} selector -
 *        A shorthand selector string (see {@link resolveQuery}) or a
 *        pre-resolved Locator/non-string value to pass through.
 * @returns {import('playwright').Locator} - The resolved Playwright
 *          Locator after applying all chained queries.
 *
 * @example
 * // Given a Playwright page:
 * resolveLocator(page.locator('body'), 'div |> :button"Submit"')
 * // Equivalent to: page.locator('body').locator('div').getByRole('button', { name: 'Submit' })
 *
 * @example
 * // Non-string passthrough:
 * const myLocator = page.locator('div');
 * resolveLocator(null, myLocator)  // returns myLocator
 */
export function resolveLocator(parent, selector) {
  if (!isString(selector) && !Array.isArray(selector)) {
    return selector;
  }
  return resolveQuery(selector)
    .reduce((R, [method, ...args]) => R[method](...args), parent);
}
