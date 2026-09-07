import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';

export const PROFILE_PICTURE_DIRECTORY = resolve(
  process.cwd(),
  'profile picture',
);
export const MAX_PROFILE_PICTURE_SIZE = 5 * 1024 * 1024;

export async function saveProfilePicture(
  file: Express.Multer.File,
): Promise<string> {
  if (!file.size || file.size > MAX_PROFILE_PICTURE_SIZE) {
    throw new BadRequestException('Choose an image up to 5 MB.');
  }
  let image: Buffer;
  try {
    const source = sharp(file.buffer, { limitInputPixels: 25000000 });
    const metadata = await source.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) {
      throw new Error('Unsupported image');
    }
    image = await source
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new BadRequestException(
      'Choose a valid JPG, PNG, or WebP image (up to 25 megapixels).',
    );
  }
  await mkdir(PROFILE_PICTURE_DIRECTORY, { recursive: true });
  const filename = randomUUID() + '.webp';
  await writeFile(join(PROFILE_PICTURE_DIRECTORY, filename), image, {
    flag: 'wx',
  });
  return '/profile-picture/' + filename;
}

export async function removeProfilePicture(url: string | null | undefined) {
  // Only delete generated image filenames within the designated upload folder.
  const match = /^\/profile-picture\/([0-9a-f-]{36}\.webp)$/.exec(url ?? '');
  if (match)
    await unlink(join(PROFILE_PICTURE_DIRECTORY, match[1])).catch(
      () => undefined,
    );
}
