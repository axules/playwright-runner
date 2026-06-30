import {
  parseCssSelector,
  resolveCustomMethod,
  resolveCssQuery,
  resolveCssLocator,
} from '../resolveCssLocator';


describe('parseCssSelector', () => {
  const testCases = [
    // Plain CSS (no :@)
    ['plain CSS tag selector', 'div', ['div']],
    ['plain CSS descendant selector', 'div button span', ['div button span']],
    ['plain CSS class selector', '.my-class', ['.my-class']],
    ['plain CSS id selector', '#my-id', ['#my-id']],
    ['plain CSS with commas (no :@ present)', 'div, button', ['div, button']],

    // :@text
    [':@text without quotes', 'div:@text(Submit)', ['div', { method: 'text', arg: 'Submit' }]],
    [
      ':@text with quoted argument containing parentheses',
      'div:@text("Submit (123 label")',
      ['div', { method: 'text', arg: 'Submit (123 label' }],
    ],

    // Other :@ methods
    [':@label', 'form:@label(email)', ['form', { method: 'label', arg: 'email' }]],
    [':@role', 'div:@role(button)', ['div', { method: 'role', arg: 'button' }]],
    [
      ':@placeholder',
      'input:@placeholder(Enter name)',
      ['input', { method: 'placeholder', arg: 'Enter name' }],
    ],
    [':@title', 'a:@title(Click here)', ['a', { method: 'title', arg: 'Click here' }]],

    // Multiple :@ methods
    [
      'multiple :@ methods on the same CSS selector',
      'div:@text(Submit):@role(button)',
      [
        'div',
        { method: 'text', arg: 'Submit' },
        { method: 'role', arg: 'button' },
      ],
    ],

    // Prefix modes
    [
      ':@ with >* prefix for filter mode',
      'div >*:@text(Submit)',
      ['div', { method: 'text', arg: 'Submit', node: '>*' }],
    ],
    [':@ with > * prefix', 'div > *:@text(Submit)', ['div', { method: 'text', arg: 'Submit', node: '> *' }]],

    // Complex mix
    [
      'complex mix of CSS selectors interspersed with :@ methods',
      'div:nth-child(3) button:@text("Submit (123 label") span button:@text(aaa):@label(*my label*) a',
      [
        'div:nth-child(3) button',
        { method: 'text', arg: 'Submit (123 label' },
        'span button',
        { method: 'text', arg: 'aaa' },
        { method: 'label', arg: '*my label*' },
        'a',
      ],
    ],

    // Edge cases
    [
      'only :@ methods and no leading CSS',
      ':@text(Hello)',
      [{ method: 'text', arg: 'Hello' }],
    ],
    [
      'trailing CSS after :@ methods',
      'div:@text(Submit) button',
      ['div', { method: 'text', arg: 'Submit' }, 'button'],
    ],
    [
      'leading whitespace is captured as node in regex',
      '  a:@text(Hello)',
      ['a', { method: 'text', arg: 'Hello' }],
    ],
  ];

  test.each(testCases)('%#. %s', (_name, input, expected) => {
    expect(parseCssSelector(input)).toEqual(expected);
  });

  describe('error cases', () => {
    test('throws on combined selectors with comma when :@ is present', () => {
      expect(() => parseCssSelector('div:@text(x), button'))
        .toThrow('Not supported combined selectors');
      expect(() => parseCssSelector('div.submit:@text(x), div.newOne'))
        .toThrow('Not supported combined selectors');
    });
  });
});

describe('resolveCustomMethod', () => {
  const testCases = [
    ['returns filter with hasText when no node is present', { method: 'text', arg: 'Submit' }, ['filter', { hasText: 'Submit' }]],
    ['returns getByText when node is present', { method: 'text', arg: 'Submit', node: '*' }, ['getByText', 'Submit']],
    ['with >* prefix node returns getByText', { method: 'text', arg: 'Submit', node: '>*' }, ['getByText', 'Submit']],
    ['resolves wildcard text to regex with filter when no node', { method: 'text', arg: '*partial*' }, ['filter', { hasText: /^.*partial.*$/i }]],
    ['returns getByLabel with plain text', { method: 'label', arg: 'email' }, ['getByLabel', 'email']],
    ['resolves wildcard label to regex', { method: 'label', arg: '*my label*' }, ['getByLabel', /^.*my label.*$/i]],
    ['returns getByRole with role name', { method: 'role', arg: 'button' }, ['getByRole', 'button']],
    ['returns getByPlaceholder', { method: 'placeholder', arg: 'Enter name' }, ['getByPlaceholder', 'Enter name']],
    ['returns getByTitle', { method: 'title', arg: 'Click here' }, ['getByTitle', 'Click here']],
    ['is case-insensitive for method TEXT', { method: 'TEXT', arg: 'Hello' }, ['filter', { hasText: 'Hello' }]],
    ['is case-insensitive for method Label', { method: 'Label', arg: 'email' }, ['getByLabel', 'email']],
  ];

  test.each(testCases)('%s', (name, method, expected) => {
    const result = resolveCustomMethod(method);
    expect(result).toEqual(expected);
  });

  describe('unknown method', () => {
    test('throws error', () => {
      expect(() => resolveCustomMethod({ method: 'unknown', arg: 'value' }))
        .toThrow('Unknown method unknown');
    });
  });
});

describe('resolveCssQuery', () => {
  const testCases = [
    ['plain CSS string (no :@ methods)', 'div button', [['locator', 'div button']]],
    [
      'string with :@text method (no node → filter)',
      'div:@text(Submit)',
      [
        ['locator', 'div'],
        ['filter', { hasText: 'Submit' }],
      ],
    ],
    [
      'string with multiple :@ methods',
      'div:@text(Submit):@role(button)',
      [
        ['locator', 'div'],
        ['filter', { hasText: 'Submit' }],
        ['getByRole', 'button'],
      ],
    ],
    [
      'array of strings',
      ['div', 'button:@text(OK)'],
      [
        ['locator', 'div'],
        ['locator', 'button'],
        ['filter', { hasText: 'OK' }],
      ],
    ],
    [
      'passes through non-string items in array',
      ['div', { method: 'text', arg: 'Hello' }],
      [['locator', 'div'], ['filter', { hasText: 'Hello' }]],
    ],
    ['filter mode when :@text has >* prefix (has node → getByText)', 'div >*:@text(Content)', [
      ['locator', 'div'],
      ['getByText', 'Content'],
    ]],
    ['complex nested selectors with :@label and :@text', 'form input:@label(email):@text(Submit)', [
      ['locator', 'form input'],
      ['getByLabel', 'email'],
      ['filter', { hasText: 'Submit' }],
    ]],
    ['only :@ methods and no leading CSS (no node → filter)', ':@text(Hello)', [
      ['filter', { hasText: 'Hello' }],
    ]],
  ];

  test.each(testCases)('%s', (_name, input, expected) => {
    expect(resolveCssQuery(input)).toEqual(expected);
  });
});

describe('resolveCssLocator', () => {
  // Mock locator that records all method calls
  function createMockLocator() {
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
  }

  describe('edge cases', () => {
    test('returns non-string selector as-is', () => {
      const locator = {};
      expect(resolveCssLocator(null, locator)).toBe(locator);
    });

    test('returns null/undefined locator as-is', () => {
      expect(resolveCssLocator(null, null)).toBeNull();
      expect(resolveCssLocator(null, undefined)).toBeUndefined();
    });
  });

  const testCases = [
    ['plain CSS selector as locator call', 'div button', [['locator', 'div button']]],
    ['CSS with :@text (no node → filter)', 'div:@text(Submit)', [
      ['locator', 'div'],
      ['filter', { hasText: 'Submit' }],
    ]],
    ['CSS with getByLabel', 'form:@label(email)', [
      ['locator', 'form'],
      ['getByLabel', 'email'],
    ]],
    ['CSS with getByRole', 'div:@role(button)', [
      ['locator', 'div'],
      ['getByRole', 'button'],
    ]],
    ['CSS with getByPlaceholder', 'input:@placeholder(Enter name)', [
      ['locator', 'input'],
      ['getByPlaceholder', 'Enter name'],
    ]],
    ['CSS with getByTitle', 'a:@title(Click here)', [
      ['locator', 'a'],
      ['getByTitle', 'Click here'],
    ]],
    ['filter mode when text method has >* prefix (has node → getByText)', 'div >*:@text(Content)', [
      ['locator', 'div'],
      ['getByText', 'Content'],
    ]],
    ['complex mix of methods',
      'div:nth-child(3) button:@text("Submit (123 label") span button:@text(aaa):@label(*my label*) a',
      [
        ['locator', 'div:nth-child(3) button'],
        ['filter', { hasText: 'Submit (123 label' }],
        ['locator', 'span button'],
        ['filter', { hasText: 'aaa' }],
        ['getByLabel', /^.*my label.*$/i],
        ['locator', 'a'],
      ],
    ],
    ['array of selectors', ['div', 'button:@text(OK)'], [
      ['locator', 'div'],
      ['locator', 'button'],
      ['filter', { hasText: 'OK' }],
    ]],
    [':@text only without leading CSS (no node → filter)', ':@text(Hello)', [
      ['filter', { hasText: 'Hello' }],
    ]],
  ];

  test.each(testCases)('%s', (_name, selector, expected) => {
    const parent = createMockLocator();
    resolveCssLocator(parent, selector);
    expect(parent._calls).toEqual(expected);
  });
});
