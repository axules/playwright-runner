"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeExpectedError = makeExpectedError;
exports.toGreenText = toGreenText;
exports.toRedText = toRedText;
function toRedText(text) {
  return `\u001b[31m${text}\u001b[39m`;
}
function toGreenText(text) {
  return `\u001b[32m${text}\u001b[39m`;
}
function makeExpectedError(received, expected) {
  return [`Expected: ${toGreenText(expected)}`, `Received: ${toRedText(received)}`].join('\n');
}