import { BadRequestException } from '@nestjs/common';
import { readFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import {
  MAX_PRODUCT_IMAGE_SIZE,
  PRODUCT_IMAGE_DIRECTORY,
  saveProductImage,
} from './product-image';

const upload = (buffer: Buffer) =>
  ({ buffer, size: buffer.length }) as Express.Multer.File;

describe('product image upload', () => {
  it.each(['png', 'jpeg', 'svg'])(
    'accepts %s and stores a static WebP',
    async (format) => {
      const svg = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="red"/></svg>',
      );
      const buffer =
        format === 'svg'
          ? svg
          : await sharp(svg)
              .toFormat(format as 'png' | 'jpeg')
              .toBuffer();
      const result = await saveProductImage(upload(buffer));
      const path = join(PRODUCT_IMAGE_DIRECTORY, basename(result.imageUrl));
      try {
        expect(result.imageUrl).toMatch(/^\/product-images\/[0-9a-f-]+\.webp$/);
        expect((await sharp(await readFile(path)).metadata()).format).toBe(
          'webp',
        );
      } finally {
        await unlink(path);
      }
    },
  );

  it('rejects missing, invalid, unsupported, and oversized uploads', async () => {
    await expect(saveProductImage()).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      saveProductImage(upload(Buffer.from('not an image'))),
    ).rejects.toBeInstanceOf(BadRequestException);
    const gif = await sharp({
      create: { width: 1, height: 1, channels: 3, background: 'red' },
    })
      .gif()
      .toBuffer();
    await expect(saveProductImage(upload(gif))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      saveProductImage({
        buffer: Buffer.alloc(1),
        size: MAX_PRODUCT_IMAGE_SIZE + 1,
      } as Express.Multer.File),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
