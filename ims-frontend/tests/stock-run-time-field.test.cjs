/* eslint-disable @typescript-eslint/no-require-imports -- Exercise TSX picker handlers in Node. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
let state = [], cursor = 0;
const filename = require.resolve("../src/components/admin/inventory/StockRunTimeField.tsx");
const compiled = new Module(filename, module); compiled.paths = module.paths;
const original = compiled.require.bind(compiled);
compiled.require = name => {
  if (name === "react") return { useId: () => "time", useEffect() {}, useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], next => { state[i] = next; }]; }, useRef: () => ({ current: { focus() {}, closest: () => null, getBoundingClientRect: () => ({ top: 100, bottom: 146, right: 500 }) } }) };
  if (name === "react-dom") return { createPortal: node => node };
  if (name.endsWith(".module.css")) return {};
  return original(name);
};
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
function find(node, predicate, result = []) {
  if (Array.isArray(node)) { node.forEach(child => find(child, predicate, result)); return result; }
  if (!node || typeof node !== "object") return result;
  if (predicate(node)) result.push(node); find(node.props?.children, predicate, result); return result;
}
function setup(value) {
  state = []; let saved;
  global.window = { innerWidth: 1000, innerHeight: 800 }; global.document = { body: {} };
  const render = () => { cursor = 0; return compiled.exports.default({ id: "received", label: "Received time (Manila)", value, onChange(next) { saved = next; } }); };
  find(render(), node => node.type === "button")[0].props.onClick();
  return { render, saved: () => saved };
}
test("navy time picker converts AM/PM correctly and applies chosen minutes", () => {
  const { render, saved } = setup("00:31");
  let tree = render();
  const group = name => find(tree, node => node.props?.["aria-label"] === name)[0];
  find(group("AM or PM"), node => node.type === "button" && node.props.children === "PM")[0].props.onClick();
  tree = render();
  find(group("Minute"), node => node.type === "button" && node.props.children === "45")[0].props.onClick();
  tree = render();
  find(tree, node => node.type === "button" && node.props.children === "Apply")[0].props.onClick();
  assert.equal(saved(), "12:45");
  assert.equal(find(render(), node => node.props?.role === "dialog").length, 0);
});
test("cancelling the picker leaves the saved time unchanged", () => {
  const { render, saved } = setup("13:15");
  const tree = render();
  find(tree, node => node.type === "button" && node.props.children === "Cancel")[0].props.onClick();
  assert.equal(saved(), undefined);
  assert.equal(find(render(), node => node.props?.role === "dialog").length, 0);
});
