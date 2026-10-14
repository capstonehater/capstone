/* eslint-disable @typescript-eslint/no-require-imports -- Build the embedded receipt logo for PDF exports. */
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const png = await sharp(path.join(root, 'public/cs-receipt.svg'))
    .resize(384, 384, { fit: 'contain' })
    .png({ palette: true, colours: 128 })
    .toBuffer();
  await fs.writeFile(path.join(root, 'src/lib/report-pdf-logo.ts'),
    '// Generated from public/cs-receipt.svg, the receipt header logo.\n' +
    '// Regenerate with: node scripts/generate-report-pdf-logo.cjs\n' +
    `export const reportPdfLogo = "data:image/png;base64,${png.toString('base64')}";\n`);
  console.log(`Embedded receipt logo: ${png.length} bytes`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
