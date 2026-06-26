import fs from 'fs';
import path from 'path';
import { takeScreenshot } from './takeScreenshot';
export async function addScreenshotReporter() {
  /* global jasmine */

  // const options = {
  //   dirName: path.parse(testsSuit.result.testPath).dir,
  //   ..._options
  // };

  jasmine.getEnv().addReporter({
    jasmineStarted: function (info) {
      console.log('jasmineStarted', info);
    },
    suiteStarted: function (info) {
      console.log('suiteStarted', info);
    },
    specDone: async function (result, z) {
      console.log('specDone', result, z);
      // if (result.status !== 'passed' && suitIncludesSpec(testsSuit, result.id)) {
      //   console.log('-----------> Report save ---> ' + options.dirName);

      //   let dirExists = fs.existsSync(options.dirName);
      //   if (!dirExists) {
      //     try {
      //       fs.mkdirSync(options.dirName, { recursive: true });
      //       dirExists = true;
      //     } catch (error) {
      //       console.error(error);
      //     }
      //     // await del([options.dirName+'/screenshots/*.png']);
      //   }

      //   if (dirExists) {
      //     console.log('--- saving ---> ' + result.fullName);
      //     const fn = await takeScreenshot(
      //       testsSuit.page, {
      //         dir: options.dirName,
      //         name: path.normalize(result.fullName)
      //       }
      //     );
      //     console.log('--- saved ---> ' + fn);
      //   }
      // }
    }
  });
}
function suitIncludesSpec(suit, specId) {
  if (!suit || !suit.children) return false;
  return suit.children.find(el => el.id == specId || el.children && !!suitIncludesSpec(el, specId));
}

// async function screenshotFailReport(result) {
//   let specName = result.fullName.replace(/\s/g, '-');

//   return new Promise(function(resolve) {
//     if (result.status === 'failed') {
//       options.page.screenshot({path: options.dirName + '/screenshots/0-fail-' + options.scriptName + '-' + specName + '.png'})
//       .then(function() { resolve(); })
//       .catch(function() { resolve(); });
//     }
//     else {
//       resolve();
//     }
//   });
// }