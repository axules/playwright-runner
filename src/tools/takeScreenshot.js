import path from 'path';
import { isPage, getPage } from './utils';
import { createDirDeep } from './createDirDeep';


const SHOT_EXT = 'jpeg';
const QUALITY = 90;

function getFullName(dir, name) {
  return path.normalize(path.join(dir, name + '.' + SHOT_EXT));
}

const versionSelectorId = `urlOtobrazatel_${String(Math.random()).slice(2)}`;

async function addUrlElement(target) {
  const page = getPage(target);
  const result = await page.evaluate((labelId) => {
    try {
      const versionLabel = window.document.createElement('div');
      versionLabel.setAttribute('id', labelId);
      versionLabel.style.position = 'fixed';
      versionLabel.style.bottom = '0px';
      versionLabel.style.left = '0px';
      versionLabel.style.right = '0px';
      versionLabel.style.zIndex = 99999999;
      versionLabel.style.fontSize = '12pt';
      versionLabel.style.fontFamily = '"Courier New", Courier, monospace';
      versionLabel.style.color = 'red';
      versionLabel.style.textAlign = 'right';
      versionLabel.style.pointerEvents = 'none';
      versionLabel.textContent = window.location.href;
      window.document.querySelector('body').appendChild(versionLabel);
      return true;
    } catch (error) {
      return error;
    }
  }, versionSelectorId);
  if (result !== true) {
    console.error('Page url can not be added to page\n', result);
  }
  return result;
}

function removeUrlElement(target) {
  const page = getPage(target);
  return page.evaluate((labelId) => {
    try {
       const versionLabel = window.document.querySelector(`#${labelId}`);
      if (versionLabel) {
        versionLabel.parentElement.removeChild(versionLabel);
      }
      return true;
    } catch (error) {
      return error;
    }
  }, versionSelectorId);
}

export async function takeScreenshot(target, options = {}) {
  const name = (typeof(options) == 'string' ? options : options.name)
    || config.prefix + String(Math.random()).slice(2, 8) + '_' + new Date().getTime();
  const config = typeof(options) == 'string' ? {} : options;
  const { save = true, returnBuffer = false, printUrl = false } = config;
  let fullName = undefined;
  if (save) {
    fullName = getFullName(config.dir, name);
    createDirDeep(path.dirname(fullName));
  }
  if (printUrl) {
    await addUrlElement(target);
  }

  const result = await target.screenshot({
    path: fullName,
    type: SHOT_EXT,
    fullPage: isPage(target),
    quality: QUALITY,
    ...config
  });

  if (printUrl) {
    await removeUrlElement(target);
  }
  return save && !returnBuffer ? name : result;
}

export function screenshoter(dirOrSuit) {
  let n = 1;
  const dir = typeof(dirOrSuit) == 'string' ? dirOrSuit : path.parse(dirOrSuit.result.testPath).dir;

  const shooter = (target, optionsOrName) => {
    const isName = typeof(optionsOrName) == 'string';
    const name = isName ? optionsOrName : optionsOrName?.name || n++;
    const options = isName ? { } : optionsOrName;
    return takeScreenshot(target, { dir, name, ...options });
  };

  shooter.getCurrentName = (name) => name || (n + 1);
  shooter.getFullName = (name) => getFullName(dir, shooter.getCurrentName(name));
  shooter.toString = () => dir;
  shooter.valueOf = shooter.toString;
  return shooter;
}
