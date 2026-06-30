"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _makeExpectedError = require("./makeExpectedError");
class MatcherError extends Error {
  constructor(message, received, expected) {
    super(`${message}\n${(0, _makeExpectedError.makeExpectedError)(received, expected)}\n`);
    this.received = received;
    this.expected = expected;
    this.name = 'MatcherError';
  }
}
exports.default = MatcherError;