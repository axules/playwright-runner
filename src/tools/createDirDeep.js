import fs from 'fs';


export function createDirDeep(dir) {
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created direcory [${dir}]`);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
    // await del([options.dirName+'/screenshots/*.png']);
  }
  return true;
}