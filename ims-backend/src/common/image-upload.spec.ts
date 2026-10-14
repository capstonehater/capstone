import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import { validatedImage, MAX_IMAGE_UPLOAD_SIZE } from './image-upload';

const upload = (buffer: Buffer, originalname = 'image.png') =>
  ({ buffer, originalname, size: buffer.length }) as Express.Multer.File;
const svg = (content: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${content}</svg>`,
  );

describe('shared image upload security', () => {
  it.each(['png', 'jpg', 'jpeg', 'svg'])(
    'accepts genuine %s images',
    async (extension) => {
      const input = svg('<rect width="10" height="10"/>');
      const buffer =
        extension === 'svg'
          ? input
          : await sharp(input)
              .toFormat(extension === 'png' ? 'png' : 'jpeg')
              .toBuffer();
      const source = await validatedImage(upload(buffer, `photo.${extension}`));
      expect((await source.webp().toBuffer()).length).toBeGreaterThan(0);
    },
  );

  it.each(['plain text', 'MZ executable', '#!/bin/sh\necho attack'])(
    'rejects disguised non-images: %s',
    async (payload) => {
      await expect(
        validatedImage(upload(Buffer.from(payload))),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it.each([
    '<script>alert(1)</script>',
    '<rect onload="alert(1)"/>',
    '<image href="https://example.com/secret"/>',
    '<use href="file:///etc/passwd"/>',
    '<foreignObject><div>unsafe</div></foreignObject>',
    '<rect style="fill:url(https://example.com/x)"/>',
  ])('rejects active SVG content: %s', async (content) => {
    await expect(
      validatedImage(upload(svg(content), 'image.svg')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects entities, appended payloads, mismatched extensions, and invalid sizes', async () => {
    const png = await sharp(svg('<rect width="10" height="10"/>'))
      .png()
      .toBuffer();
    const jpeg = await sharp(png).jpeg().toBuffer();
    for (const file of [
      upload(Buffer.concat([png, Buffer.from('MZ payload')])),
      upload(Buffer.concat([jpeg, Buffer.from('text')]), 'image.jpg'),
      upload(
        Buffer.concat([
          jpeg,
          Buffer.from('MZ payload'),
          Buffer.from([0xff, 0xd9]),
        ]),
        'image.jpg',
      ),
      upload(png, 'image.jpg'),
      upload(png, 'image.exe'),
      upload(
        Buffer.from(
          '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' +
            svg('<text>&x;</text>').toString(),
        ),
        'image.svg',
      ),
      upload(Buffer.alloc(MAX_IMAGE_UPLOAD_SIZE + 1)),
      { ...upload(png), size: 1 },
      upload(Buffer.alloc(0)),
    ])
      await expect(validatedImage(file)).rejects.toBeInstanceOf(
        BadRequestException,
      );
  });
});
