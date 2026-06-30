"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.RunnerLocator = void 0;
var _resolveLocator = require("./resolveLocator");
class RunnerLocator {
  _chain = [];
  constructor(root = 'body') {
    this._chain.push(root);
  }
  get root() {
    return this._chain[0];
  }
  filterByText(text) {
    this.push(`"${text}"`);
    return this;
  }
  byText(text) {
    this.push(`:"${text}"`);
    return this;
  }
  byRole(role) {
    this.push(`:${role}`);
    return this;
  }
  find(css) {
    this.push(css);
  }
  push(node) {
    this._chain.push(node);
    return this;
  }
  get chain() {
    return this._chain;
  }
  get resolvedChain() {
    return (0, _resolveLocator.resolveQuery)(this.chain);
  }
}
exports.RunnerLocator = RunnerLocator;