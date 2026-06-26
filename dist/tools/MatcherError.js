import { makeExpectedError } from './makeExpectedError';
export default class MatcherError extends Error {
  constructor(message, received, expected) {
    super(`${message}\n${makeExpectedError(received, expected)}\n`);
    this.received = received;
    this.expected = expected;
    this.name = 'MatcherError';
  }
}