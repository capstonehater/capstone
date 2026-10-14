import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { validatedImage, MAX_IMAGE_UPLOAD_SIZE } from '../common/image-upload';

export const PRODUCT_IMAGE_DIRECTORY = resolve(process.cwd(), 'product-images');
export const MAX_PRODUCT_IMAGE_SIZE = MAX_IMAGE_UPLOAD_SIZE;

export async function removeProductImage(url: string) {
  const match =
    /^\/product-images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp)$/.exec(
      url,
    );
  if (!match) return;
  try {
    await unlink(join(PRODUCT_IMAGE_DIRECTORY, match[1]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function saveProductImage(file?: Express.Multer.File) {
  const source = await validatedImage(file);
  let image: Buffer;
  try {
    // Rasterize SVGs instead of serving user-provided active SVG content.
    image = await source
      .rotate()
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'Choose a valid SVG, JPG, JPEG, or PNG image (up to 25 megapixels).',
    );
  }
  await mkdir(PRODUCT_IMAGE_DIRECTORY, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await writeFile(join(PRODUCT_IMAGE_DIRECTORY, filename), image, {
    flag: 'wx',
  });
  return { imageUrl: `/product-images/${filename}` };
}
