"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.diffImages = diffImages;
var _fs = _interopRequireDefault(require("fs"));
var _jpegJs = _interopRequireDefault(require("jpeg-js"));
var _pixelmatch = _interopRequireDefault(require("pixelmatch"));
var _pngjs = require("pngjs");
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function isString(a) {
  return typeof a === 'string';
}
function getExt(fn) {
  return fn.split('.').pop().toLowerCase();
}
function isPng(fn) {
  return isString(fn) && getExt(fn) === 'png';
}
function readBuffer(file, defaultPng) {
  if (isString(file)) {
    const buffer = _fs.default.readFileSync(file);
    return isPng(file) ? _pngjs.PNG.sync.read(buffer) : _jpegJs.default.decode(buffer);
  } else {
    return defaultPng ? _pngjs.PNG.sync.read(file) : _jpegJs.default.decode(file);
  }
}
function diffImages(expected, actual, threshold = 0.05) {
  const png = isPng(expected) || isPng(actual);
  const expectedBuffer = readBuffer(expected, png);
  const actualBuffer = readBuffer(actual, png);
  const diff = new _pngjs.PNG({
    width: expectedBuffer.width,
    height: expectedBuffer.height
  });
  const result = (0, _pixelmatch.default)(expectedBuffer.data, actualBuffer.data, diff.data, expectedBuffer.width, expectedBuffer.height, {
    threshold
  });
  diff.save = fn => _fs.default.writeFileSync(fn, _pngjs.PNG.sync.write(diff));
  return {
    count: result,
    diff,
    width: expectedBuffer.width,
    height: expectedBuffer.height
  };
}