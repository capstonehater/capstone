/* eslint-disable @typescript-eslint/no-require-imports -- Build utility. */
const sharp = require('sharp');
const path = require('node:path');

const assets = path.resolve(__dirname, '../public/assets');
sharp(path.join(assets, 'slvcn-icon.svg'))
  .resize(64, 64)
  .png({ compressionLevel: 9 })
  .toFile(path.join(assets, 'slvcn-icon-64.png'))
  .then(info => console.log(`Generated 64px favicon (${info.size} bytes).`))
  .catch(error => { console.error(error); process.exitCode = 1; });
