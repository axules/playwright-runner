import {resolveQuery, resolveQueryPiece, resolveText} from "../resolveLocator";


describe('resolveQuery', () => {
  const testCases = [
    ['div |> :button"Submit"', [['locator', 'div'], ['getByRole', 'button', { name: 'Submit'}]]],
  ];

  test.each(testCases)('', (value, expected) => {
    const result = resolveQuery(value);
    expect(result).toEqual(expected);
  })
});

describe('resolveText', () => {
  const testCases = [
    ['Button title', 'Button title'],
    ['*Button title*', /^.*Button title.*$/i],
    ['*Button title', /^.*Button title$/i],
    ['Button title*', /^Button title.*$/i],
    ['Button* title*', /^Button.* title.*$/i],
  ];

  test.each(testCases)('%#. %s', (value, expected) => {
    const result = resolveText(value);
    expect(result).toEqual(expected);
  });
});

describe('resolveQueryPiece', () => {
  const testCases = [
    [':"Button title"', ['getByText', 'Button title']],
    [':"*Button title*"', ['getByText', /^.*Button title.*$/i]],
    [':~Field label', ['getByLabel', 'Field label']],
    [':~Field label*', ['getByLabel', /^Field label.*$/i]],
    [':button"*Button title*"', ['getByRole', 'button', { name: /^.*Button title.*$/i }]],
    ['button:at(2)', ['locator', 'button:at(2)']]
  ];

  test.each(testCases)('%#. %s', (value, expected) => {
    const result = resolveQueryPiece(value);
    expect(result).toEqual(expected);
  });
});