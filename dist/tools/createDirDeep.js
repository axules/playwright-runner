"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createDirDeep = createDirDeep;
var _fs = _interopRequireDefault(require("fs"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
function createDirDeep(dir) {
  if (!_fs.default.existsSync(dir)) {
    try {
      _fs.default.mkdirSync(dir, {
        recursive: true
      });
      // eslint-disable-next-line no-console
      console.log(`Created directory [${dir}]`);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
    // await del([options.dirName+'/screenshots/*.png']);
  }
  return true;
}