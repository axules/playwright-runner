import isString from 'lodash.isstring';

// :button"button text" - getByRole('button', { text: "button text" })
// :button"*button text*" - getByRole('button', { text: /button text/i })
// :"*button text*" - getByText(/button text/i)
// :~*button text* - getByLabel(/button text/i)

export function resolveText(text) {
  if (text.includes('*')) {
    return new RegExp(`^${text.replaceAll('*', '.*')}$`, 'i');
  }
  return text;
}

export function resolveQueryPiece(locatorPiece) {
  if (locatorPiece.startsWith(':"')) {
    const [, text] = locatorPiece.match(/:"([^[\]].+)"/);
    return ['getByText', resolveText(text)];
  } else if (locatorPiece.startsWith('"')) {
    const [, text] = locatorPiece.match(/"([^[\]].+)"/);
    return ['getByText', resolveText(text)];
  } else if (locatorPiece.startsWith(':~')) {
    return ['getByLabel', resolveText(locatorPiece.slice(2))];
  } else if (locatorPiece.startsWith(':')) {
    const [, role, text] = locatorPiece.match(/:(.+)"([^[\]].+)"/);
    return ['getByRole', role, { name: resolveText(text) }];
  }
  return ['locator', locatorPiece];
}

export function resolveQuery(value) {
  const pieces = value.split('|>');
  return pieces.map(it => resolveQueryPiece(it.trim()));
}

export function resolveLocator(parent, selector) {
  if (!isString(selector)) {
    return selector;
  }
  return resolveQuery(selector)
    .reduce((R, [method, ...args]) => R[method](...args), parent);
}
