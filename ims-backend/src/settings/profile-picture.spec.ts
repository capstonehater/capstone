import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { writeFile, unlink } from 'node:fs/promises';
import { saveProfilePicture, removeProfilePicture, MAX_PROFILE_PICTURE_SIZE } from './profile-picture';

jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

function upload(buffer: Buffer): Express.Multer.File {
  return { buffer, size: buffer.length, mimetype: 'image/png' } as Express.Multer.File;
}

describe('profile pictures', () => {
  beforeEach(() => jest.clearAllMocks());

  it('decodes and resizes a real image, saving a unique WebP URL', async () => {
    const input = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#f45a1f' } }).png().toBuffer();
    const url = await saveProfilePicture(upload(input));
    expect(url).toMatch(/^\/profile-picture\/[0-9a-f-]{36}\.webp$/);
    const output = jest.mocked(writeFile).mock.calls[0][1] as Buffer;
    const metadata = await sharp(output).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 512, height: 512 });
  });

  it('rejects fake images even when the upload claims an image MIME type', async () => {
    await expect(saveProfilePicture(upload(Buffer.from('not an image')))).rejects.toBeInstanceOf(BadRequestException);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects oversized files before writing', async () => {
    const file = upload(Buffer.from('x'));
    file.size = MAX_PROFILE_PICTURE_SIZE + 1;
    await expect(saveProfilePicture(file)).rejects.toBeInstanceOf(BadRequestException);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('does not delete paths outside generated profile pictures', async () => {
    await removeProfilePicture('/profile-picture/../../.env');
    await removeProfilePicture('/other/file.webp');
    expect(unlink).not.toHaveBeenCalled();
  });
});
