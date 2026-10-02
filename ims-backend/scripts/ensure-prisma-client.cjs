const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const generated = resolve(root, 'node_modules/.prisma/client');
const schema = resolve(root, 'prisma/schema.prisma');
const normalize = (value) =>
  JSON.stringify(value.match(/"(?:\\.|[^"\\])*"|[^\s"]+/g));
let current = false;
try {
  current =
    existsSync(resolve(generated, 'index.js')) &&
    normalize(readFileSync(schema, 'utf8')) ===
      normalize(readFileSync(resolve(generated, 'schema.prisma'), 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

// Avoid replacing a loaded Prisma engine DLL on Windows when already current.
if (!current) {
  const result = spawnSync(
    process.execPath,
    [resolve(root, 'node_modules/prisma/build/index.js'), 'generate'],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
