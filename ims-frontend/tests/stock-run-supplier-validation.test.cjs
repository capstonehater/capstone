/* eslint-disable @typescript-eslint/no-require-imports -- Exercise stock-run form handlers in Node. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const filename = require.resolve("../src/components/admin/inventory/StockRunModals.tsx");
let state = [], cursor = 0;
const Select = () => null;
const Validation = () => null;
const compiled = new Module(filename, module); compiled.paths = module.paths;
const originalRequire = compiled.require.bind(compiled);
compiled.require = name => {
  if (name === "react") return { useEffect() {}, useState(initial) { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], value => { state[index] = value; }]; } };
  if (name === "@/components/admin/AdminSelect") return { __esModule: true, default: Select };
  if (name === "./InventoryValidationField") return { __esModule: true, default: Validation };
  if (name === "@/lib/units") return { formatUnit: value => value };
  if (name === "@/lib/stock-run-receiving") return { currentManilaReceivingDateTime: () => "2026-10-07T23:24" };
  if (name === "@/lib/stock-run-pricing") return { defaultStockRunPriceBasis: () => ({}), priceQuantityInInventoryUnits: value => value, stockRunPriceUnitOptions: () => [] };
  if (name.includes(".module.css")) return {};
  if (name.startsWith("@/components/") || name === "./StockRunDateField") return { __esModule: true, default: () => null, PermissionAction: () => null, InventoryField: () => null };
  return originalRequire(name);
};
compiled._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
function nodes(node, type, result = []) {
  if (Array.isArray(node)) { node.forEach(child => nodes(child, type, result)); return result; }
  if (!node || typeof node !== "object") return result;
  if (node.type === type) result.push(node);
  nodes(node.props?.children, type, result); return result;
}
test("Select supplier highlights an error and blocks adding a stock-run item", () => {
  state = []; let submissions = 0;
  const form = { rawMaterialId: "material-1", supplierId: "", quantity: "10", costPerUnit: "100", costQuantity: "1", costUnitCode: "count", expirationDate: "2026-12-15", receivedAt: "2026-10-07T23:24", note: "" };
  const props = { activePanel: "stock-run-manage", submitting: false, summaries: [{ rawMaterialId: "material-1", name: "Milk", unit: { code: "count" } }], suppliers: [{ id: "supplier-1", name: "Store" }], activeStockRun: { id: "run-1", status: "DRAFT", name: "Run", reference: "ST-RUN-20261007-002", items: [] }, activeStockRunId: "run-1", stockRunItemForm: form, stockRunForm: { name: "", notes: "" }, onStockRunItemFormChange(update) { Object.assign(form, update(form)); }, onAddStockRunItem() { submissions++; }, formatQuantity: value => value, formatMoney: value => value, formatDate: value => value };
  const render = () => { cursor = 0; return compiled.exports.default(props); };
  let tree = render();
  assert.equal(nodes(tree, "h3")[0].props.children, "Run");
  assert.ok(nodes(tree, "p").some(node => node.props.children === "ST-RUN-20261007-002"));
  const price = nodes(tree, "input").find(node => node.props.id === "stock-run-item-cost").props;
  assert.equal(price.inputMode, "decimal");
  price.onChange({ target: { value: "999999" } });
  assert.equal(form.costPerUnit, "999999");
  for (const value of ["1000000", "123456.7", "-100", "1e3", "😀"]) {
    price.onChange({ target: { value } });
    assert.equal(form.costPerUnit, "999999");
  }
  price.onChange({ target: { value: "1234.56" } });
  assert.equal(form.costPerUnit, "1234.56");
  const formNode = nodes(tree, "form")[0];
  const add = nodes(formNode, "button").find(node => node.props.type === "submit");
  assert.equal(add.props.disabled, false);
  formNode.props.onInvalidCapture();
  tree = render();
  assert.equal(nodes(tree, Validation)[0].props.error, "Select a supplier before adding this item.");
  let prevented = false;
  nodes(tree, "form")[0].props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true); assert.equal(submissions, 0);
  nodes(tree, Select).find(node => node.props.label === "Supplier").props.onChange("supplier-1");
  tree = render();
  assert.equal(nodes(tree, Validation)[0].props.error, undefined);
  nodes(tree, "form")[0].props.onSubmit({ preventDefault() {} });
  assert.equal(submissions, 1);
  nodes(tree, Select).find(node => node.props.label === "Supplier").props.onChange("");
  tree = render();
  assert.ok(nodes(tree, Validation)[0].props.error);
});
