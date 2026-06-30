"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class ShotMatchError extends Error {
  constructor(name, count, diff) {
    super('Screenshots have diffirence');
    this.diffName = name;
    this.diffResult = diff;
    this.diffCount = count;
    this.name = 'ShotMatchError';
  }
}
exports.default = ShotMatchError;