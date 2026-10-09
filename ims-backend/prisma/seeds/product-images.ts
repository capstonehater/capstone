import { mkdir, access, copyFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { stableId } from './deterministic';

const directory = resolve(process.cwd(), 'product-images');
const bundledDirectory = resolve(__dirname, 'product-images');
const escapeXml = (value: string) => value.replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);

export function seedImageUrl(category: string, productName: string): string {
  return `/product-images/${stableId('menu-product-image', `${category}:${productName}`)}.webp`;
}

/** Install bundled menu-reference product photos at their stable POS URLs. */
export async function ensureSeedProductImages(products: Array<{ category: string; name: string }>, refreshPlaceholders = false) {
  await mkdir(directory, { recursive: true });
  const manifest: Array<{ category: string; product: string; imageUrl: string; status: string }> = [];
  for (const product of products) {
    const imageUrl = seedImageUrl(product.category, product.name);
    const filename = imageUrl.split('/').pop()!;
    const filePath = join(directory, filename);
    const bundledPath = join(bundledDirectory, filename);
    try {
      await access(bundledPath);
      await copyFile(bundledPath, filePath);
      manifest.push({ category: product.category, product: product.name, imageUrl, status: 'menu-reference-generated-photo' });
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    manifest.push({
      category: product.category,
      product: product.name,
      imageUrl,
      status: 'placeholder-awaiting-menu-poster-reference',
    });
    if (!refreshPlaceholders) {
      try {
        await access(filePath);
        continue;
      } catch {
        // The image is absent; create a readable, branded holding tile.
      }
    }
    const titleWords = product.name.split(/\s+/);
    const titleLines: string[] = [];
    let currentLine = '';
    for (const word of titleWords) {
      if (`${currentLine} ${word}`.trim().length > 24 && currentLine) {
        titleLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = `${currentLine} ${word}`.trim();
      }
    }
    if (currentLine) titleLines.push(currentLine);
    const title = titleLines.slice(0, 2).map((line, index) =>
      `<tspan x="55" dy="${index === 0 ? 0 : 42}">${escapeXml(line)}</tspan>`).join('');
    const category = escapeXml(product.category.toUpperCase());
    const svg = `<svg width="720" height="720" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#f7f0e8"/><stop offset="1" stop-color="#e8dfd3"/></linearGradient></defs>
      <rect width="720" height="720" fill="url(#bg)"/>
      <circle cx="600" cy="105" r="170" fill="#ad8731" opacity=".13"/>
      <circle cx="55" cy="660" r="220" fill="#ad8731" opacity=".1"/>
      <text x="55" y="90" fill="#173b33" font-size="27" font-family="Arial, sans-serif" font-weight="bold">CAFÉ SALVACION</text>
      <path d="M250 210h220l-22 250q-5 45-72 45h-32q-67 0-72-45z" fill="none" stroke="#173b33" stroke-width="13"/>
      <path d="M470 255h42q65 0 65 62t-67 65h-39" fill="none" stroke="#173b33" stroke-width="13"/>
      <path d="M283 530h152" stroke="#ad8731" stroke-width="9" stroke-linecap="round"/>
      <text x="55" y="595" fill="#ad8731" font-size="24" font-family="Arial, sans-serif">${category}</text>
      <text x="55" y="640" fill="#173b33" font-size="34" font-family="Arial, sans-serif" font-weight="bold">${title}</text>
    </svg>`;
    const webp = await sharp(Buffer.from(svg)).webp({ quality: 85 }).toBuffer();
    await writeFile(filePath, webp, { flag: refreshPlaceholders ? 'w' : 'wx' });
  }
  await writeFile(join(directory, 'synthetic-menu-image-manifest.json'), JSON.stringify(manifest, null, 2));
}
