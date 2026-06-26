import fs from 'fs';
import jpegJs from 'jpeg-js';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
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
    const buffer = fs.readFileSync(file);
    return isPng(file) ? PNG.sync.read(buffer) : jpegJs.decode(buffer);
  } else {
    return defaultPng ? PNG.sync.read(file) : jpegJs.decode(file);
  }
}
export function diffImages(expected, actual, threshold = 0.05) {
  const png = isPng(expected) || isPng(actual);
  const expectedBuffer = readBuffer(expected, png);
  const actualBuffer = readBuffer(actual, png);
  const diff = new PNG({
    width: expectedBuffer.width,
    height: expectedBuffer.height
  });
  const result = pixelmatch(expectedBuffer.data, actualBuffer.data, diff.data, expectedBuffer.width, expectedBuffer.height, {
    threshold
  });
  diff.save = fn => fs.writeFileSync(fn, PNG.sync.write(diff));
  return {
    count: result,
    diff,
    width: expectedBuffer.width,
    height: expectedBuffer.height
  };
}