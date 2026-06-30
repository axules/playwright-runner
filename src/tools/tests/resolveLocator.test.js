import {
  resolveLocator,
  resolveQuery,
  resolveQueryPiece,
  resolveText,
} from '../resolveLocator';


describe('resolveQuery', () => {
  const testCases = [
    ['div |> :button"Submit"', [['locator', 'div'], ['getByRole', 'button', { name: 'Submit' }]]],
    ['div |> :"Text" |> button', [['locator', 'div'], ['getByText', 'Text'], ['locator', 'button']]],
    ['form |> :~email', [['locator', 'form'], ['getByLabel', 'email']]],
    ['div', [['locator', 'div']]],
    [['div', ':"Text"'], [['locator', 'div'], ['getByText', 'Text']]],
  ];

  test.each(testCases)('%#. %s', (value, expected) => {
    const result = resolveQuery(value);
    expect(result).toEqual(expected);
  });
});

describe('resolveText', () => {
  const testCases = [
    ['Button title', 'Button title'],
    ['*Button title*', /^.*Button title.*$/i],
    ['*Button title', /^.*Button title$/i],
    ['Button title*', /^Button title.*$/i],
    ['Button* title*', /^Button.* title.*$/i],
    ['', ''],
    ['*', /^.*$/i],
    ['Price (10$)', 'Price (10$)'],
  ];

  test.each(testCases)('%#. %s', (value, expected) => {
    const result = resolveText(value);
    expect(result).toEqual(expected);
  });
});

describe('resolveQueryPiece', () => {
  const testCases = [
    [':"Button title"', ['getByText', 'Button title']],
    ['"Button title"', ['filter', { hasText: 'Button title' }]],
    [':"*Button title*"', ['getByText', /^.*Button title.*$/i]],
    [':~Field label', ['getByLabel', 'Field label']],
    [':~Field label*', ['getByLabel', /^Field label.*$/i]],
    [':~*Field label*', ['getByLabel', /^.*Field label.*$/i]],
    [':~*Field label', ['getByLabel', /^.*Field label$/i]],
    [':button"*Button title*"', ['getByRole', 'button', { name: /^.*Button title.*$/i }]],
    [':button"Submit"', ['getByRole', 'button', { name: 'Submit' }]],
    ['button:at(2)', ['locator', 'button:at(2)']],
    ['[data-testid="submit-btn"]', ['locator', '[data-testid="submit-btn"]']],
    ['div.container', ['locator', 'div.container']],
    ['#main-header', ['locator', '#main-header']],
  ];

  test.each(testCases)('%#. %s', (value, expected) => {
    const result = resolveQueryPiece(value);
    expect(result).toEqual(expected);
  });
});

describe('resolveLocator', () => {
  const mockLocator = () => {
    const calls = [];
    const handler = {
      get(target, prop) {
        if (prop === '_calls') return calls;
        return (...args) => {
          calls.push([prop, ...args]);
          return new Proxy(() => {}, handler);
        };
      },
      apply(target, thisArg, args) {
        calls.push(['locator', ...args]);
        return new Proxy(() => {}, handler);
      },
    };
    return new Proxy(() => {}, handler);
  };

  const testCases = [
    ['plain css', 'div button', [['locator', 'div button']]],
    ['getByText exact', ':"Hello"', [['getByText', 'Hello']]],
    ['getByLabel regex', ':~*label*', [['getByLabel', /^.*label.*$/i]]],
    ['chained', 'div |> :button"OK"', [['locator', 'div'], ['getByRole', 'button', { name: 'OK' }]]],
    ['array', ['div', ':"Text"'], [['locator', 'div'], ['getByText', 'Text']]],
  ];

  test.each(testCases)('%#. %s', (_, selector, expectedCalls) => {
    const parent = mockLocator();
    resolveLocator(parent, selector);
    expect(parent._calls).toEqual(expectedCalls);
  });

  test('returns selector as-is when not a string', () => {
    const locator = {};
    expect(resolveLocator(null, locator)).toBe(locator);
  });
});
