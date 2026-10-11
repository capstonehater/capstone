/* eslint-disable @typescript-eslint/no-require-imports -- Node support for Next.js source imports. */
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText, filename,
  );
}
const load = Module._load;
Module._load = function (name, parent, main) {
  if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  if (name.startsWith('@/')) name = path.resolve(__dirname, '../../src', name.slice(2));
  return load.call(this, name, parent, main);
};
