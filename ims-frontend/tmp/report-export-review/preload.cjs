const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require(path.resolve('node_modules/typescript'));
require.extensions['.ts'] = (loaded, filename) => loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const originalLoad = Module._load;
Module._load = function (name, parent, ...rest) {
  if (name === './report-export-access') return { authorizeReportExport: async () => {} };
  return originalLoad.call(this, name, parent, ...rest);
};
