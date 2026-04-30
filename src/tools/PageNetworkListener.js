export default class PageNetworkListener {
  constructor(page) {
    this.activeRequests = 0;
    this.page = page;
    this.requests = [];
    this.lastRequest = null;
    this.active = false;

    page.on('request', (request) => {
      this.listenRequestStart(request);
    });
    page.on('requestfinished', (request) => {
      this.listenRequestEnd(request);
    });
    page.on('requestfailed', (request) => {
      this.listenRequestEnd(request);
    });

    // page.on('response', (response) => {
    //   console.log('!!!!!!! response');
    //   this.listenResponse(response);
    // });
  }

  listenRequestStart(request) {
    // console.log('listenRequestStart', this.active, request.url());
    this.activeRequests += 1;
    this.lastRequest = new ListenedRequest(request);
    if (!this.active) return false;
    this.requests.push(new ListenedRequest(request));
  }

  listenRequestEnd(request) {
    this.activeRequests -= this.activeRequests ? 1 : 0;
    this.lastRequest?.finish(request);
    if (!this.active) return false;
    const listened = this.requests.find(el => el.is(request));
    if (!listened) return false;
    listened.finish(request);
  }

  startListen() {
    this.requests = [];
    this.active = true;
  }

  stopListen() {
    this.active = false;
  }

  findRequests(matcher, onlyFinished = false) {
    return this.requests.filter(el => {
      if (onlyFinished && !el.finished) return false;
      if (typeof matcher === 'function') {
        return !!matcher(el.request());
      }
      if (typeof matcher === 'string') {
        return el.request().url().includes(matcher);
      }
      if (matcher instanceof RegExp) {
        return !!el.request().url().match(matcher);
      }
    });
  }
}

class ListenedRequest {
  constructor(request) {
    this._request = request;
    this.started = new Date();
    this.finished = null;
  }

  finish(request) {
    if (this.is(request)) {
      this.finished = new Date();
      return true;
    }
    return false;
  }

  duration() {
    return this.finished ? this.finished.getTime() - this.started.getTime() : 0;
  }

  response() {
    return this.request.response();
  }

  request() {
    return this._request;
  }

  is(request) {
    return this._request === request;
  }
}