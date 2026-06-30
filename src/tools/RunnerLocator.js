import { resolveQuery } from './resolveLocator';


export class RunnerLocator {
  _chain = [];

  constructor(root = 'body') {
    this._chain.push(root);
  }

  get root() { return this._chain[0]; }

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
    return resolveQuery(this.chain);
  }
}
