import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';
import { SaxesParser } from 'saxes';
import sharp from 'sharp';

export const MAX_IMAGE_UPLOAD_SIZE = 5 * 1024 * 1024;
const formats: Record<string, string> = {
  '.png': 'png',
  '.jpg': 'jpeg',
  '.jpeg': 'jpeg',
  '.svg': 'svg',
};
const svgElements = new Set([
  'svg',
  'g',
  'defs',
  'title',
  'desc',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'textPath',
  'use',
  'symbol',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'pattern',
]);

function validateSvg(buffer: Buffer) {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  const parser = new SaxesParser({ xmlns: true });
  let rootSeen = false;
  const reject = () => {
    throw new Error('Unsafe SVG content');
  };
  parser.on('error', reject);
  parser.on('doctype', reject);
  parser.on('processinginstruction', reject);
  parser.on('opentag', (tag) => {
    if (!rootSeen && tag.local !== 'svg') reject();
    rootSeen = true;
    if (tag.uri !== 'http://www.w3.org/2000/svg' || !svgElements.has(tag.local))
      reject();
    for (const attribute of Object.values(tag.attributes)) {
      if (attribute.name === 'xmlns' || attribute.prefix === 'xmlns') continue;
      if (/^on/i.test(attribute.local) || attribute.local === 'base') reject();
      if (
        attribute.local === 'href' &&
        !/^#[A-Za-z_][\w:.-]*$/.test(attribute.value)
      )
        reject();
      // Only local fragment references are allowed in presentation/style values.
      const value = attribute.value.replace(
        /url\(\s*(['"]?)#[\w:.-]+\1\s*\)/gi,
        '',
      );
      if (
        /url\s*\(|@import|javascript:|data:|https?:|file:|\\|\/\*/i.test(value)
      )
        reject();
    }
  });
  parser.write(xml).close();
  if (!rootSeen) reject();
}

function validateJpeg(bytes: Buffer) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid JPEG');
  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new Error('Invalid JPEG marker');
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw new Error('Appended JPEG payload');
      return;
    }
    if (marker === 0 || marker === 0xd8 || marker === undefined)
      throw new Error('Invalid JPEG marker');
    if (marker === 1 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) throw new Error('Truncated JPEG');
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length)
      throw new Error('Invalid JPEG segment');
    offset += length;
    if (marker === 0xda) {
      // Scan entropy data, skipping escaped FF bytes and restart markers.
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        let next = offset + 1;
        while (bytes[next] === 0xff) next++;
        if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) {
          offset = next + 1;
        } else break;
      }
    }
  }
  throw new Error('Missing JPEG ending');
}

/** Validate untrusted bytes before decoding; never persist the original upload. */
export async function validatedImage(file?: Express.Multer.File) {
  if (
    !file ||
    !Buffer.isBuffer(file.buffer) ||
    !file.buffer.length ||
    file.size !== file.buffer.length ||
    file.buffer.length > MAX_IMAGE_UPLOAD_SIZE
  ) {
    throw new BadRequestException('Choose an image up to 5 MB.');
  }
  try {
    const format = formats[extname(file.originalname ?? '').toLowerCase()];
    if (!format) throw new Error('Unsupported extension');
    const bytes = file.buffer;
    if (format === 'png') {
      if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
        throw new Error('Invalid PNG');
      // Reject truncated files and appended text/executable payloads after IEND.
      let offset = 8;
      let ended = false;
      while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset);
        const type = bytes.toString('ascii', offset + 4, offset + 8);
        offset += length + 12;
        if (offset > bytes.length) throw new Error('Invalid chunk');
        if (type === 'IEND') {
          ended = length === 0 && offset === bytes.length;
          break;
        }
      }
      if (!ended) throw new Error('Invalid PNG ending');
    } else if (format === 'jpeg') {
      validateJpeg(bytes);
    } else {
      validateSvg(bytes);
    }
    const source = sharp(bytes, {
      limitInputPixels: 25000000,
      failOn: 'warning',
    });
    const metadata = await source.metadata();
    if (metadata.format !== format)
      throw new Error('Image content does not match extension');
    return source;
  } catch {
    throw new BadRequestException(
      'Choose a valid PNG, JPG, JPEG, or safe SVG image (up to 5 MB and 25 megapixels). Text files, executables, and unsafe image content are rejected.',
    );
  }
}
