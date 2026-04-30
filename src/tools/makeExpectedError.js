export function makeExpectedError(received, expected) {
  return [
    `Expected: ${toGreenText(expected)}`,
    `Received: ${toRedText(received)}`,
  ].join('\n');

}

export function toRedText(text) {
  return `\u001b[31m${text}\u001b[39m`;
}

export function toGreenText(text) {
  return `\u001b[32m${text}\u001b[39m`;
}