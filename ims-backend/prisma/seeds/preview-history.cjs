const { MATERIALS, VARIANTS, SUPPLIERS, MODIFIERS } = require('./catalog');
const { stableId } = require('./deterministic');
const { seedOperationalHistory } = require('./operational-history');
const ids = {
  materialIds: new Map(MATERIALS.map((item) => [item.key, stableId('raw-material', item.key)])),
  variantIds: new Map(VARIANTS.map((item) => [item.key, stableId('product-variant', item.key)])),
  supplierIds: new Map(SUPPLIERS.map((item) => [item.key, stableId('supplier', item.key)])),
  modifierIds: new Map(MODIFIERS.map((item) => [item.key, stableId('modifier', item.key)])),
  staffUserIds: [stableId('mock', 'staff')],
  administratorUserIds: [stableId('mock', 'admin')],
};
const fake = new Proxy({}, {
  get: (_target, name) => name === '$executeRaw'
    ? async () => 0
    : new Proxy({}, { get: () => async () => ({ count: 0 }) }),
});
seedOperationalHistory(fake, ids, '2021-10-07', '2026-10-07')
  .then((counts) => console.log(JSON.stringify(counts)))
  .catch((error) => { console.error(error); process.exitCode = 1; });
