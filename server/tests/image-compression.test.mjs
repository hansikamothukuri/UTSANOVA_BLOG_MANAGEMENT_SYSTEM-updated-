/**
 * Tests for server-side image compression (utils/imageCompression.js) together with the existing
 * validation (utils/imageValidation.js).
 *
 * Run from the project root (Node 18+):
 *   node --test server/tests/image-compression.test.mjs
 *
 * - The "pure logic" tests always run (no image library needed).
 * - The "real sharp" tests need the `sharp` package (npm install). If it is not installed they are
 *   SKIPPED (reported as skipped, not as passed). They generate all fixtures in memory; nothing is
 *   written to disk, and no network / Cloudinary / database is used.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compressImage, IMAGE_COMPRESSION, isAnimatedPng, isAnimatedWebp } from '../src/utils/imageCompression.js';
import { validateImageFile, detectImageType, MAX_IMAGE_BYTES } from '../src/utils/imageValidation.js';

let sharp = null;
try {
  sharp = (await import('sharp')).default;
} catch {
  sharp = null;
}
const REAL = { skip: sharp ? false : 'sharp is not installed (run npm install)' };

const file = (buffer, mimetype) => ({ buffer, mimetype, size: buffer.length });
const MAX = IMAGE_COMPRESSION.MAX_DIMENSION;

// ---------- fixtures (real sharp) ----------
const noiseJpeg = (w, h, quality, orientation) => {
  let img = sharp({
    create: { width: w, height: h, channels: 3, background: { r: 128, g: 128, b: 128 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
  }).jpeg({ quality });
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
};
const sceneSvg = (w, h) => `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <circle cx="${w * 0.33}" cy="${h * 0.4}" r="${h * 0.25}" fill="#10b981" fill-opacity=".8"/>
  <circle cx="${w * 0.66}" cy="${h * 0.6}" r="${h * 0.2}" fill="#ef4444" fill-opacity=".7"/></svg>`;
// transparent canvas with one opaque circle in the middle
const transparentSvg = (w, h) => `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#6366f1"/></svg>`;
const sceneJpeg = (w, h, q = 95) => sharp(Buffer.from(sceneSvg(w, h))).jpeg({ quality: q }).toBuffer();
const transparentPng = (w, h) => sharp(Buffer.from(transparentSvg(w, h))).png().toBuffer();
const transparentWebp = (w, h) => sharp(Buffer.from(transparentSvg(w, h))).webp({ quality: 90 }).toBuffer();

const alphaAt = async (buf, x, y) => {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * info.width + x) * info.channels + 3];
};
const meanAbsError = async (a, b, w, h) => {
  const ra = await sharp(a).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const rb = await sharp(b).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  let sum = 0;
  for (let i = 0; i < ra.length; i++) sum += Math.abs(ra[i] - rb[i]);
  return sum / ra.length;
};

// ======================================================================
describe('pure logic (always runs)', () => {
  it('detects animated WebP (VP8X animation flag) and ignores still WebP', () => {
    const vp8x = (flags) => {
      const b = Buffer.alloc(40);
      b.write('RIFF', 0, 'latin1');
      b.write('WEBP', 8, 'latin1');
      b.write('VP8X', 12, 'latin1');
      b[20] = flags;
      return b;
    };
    assert.equal(isAnimatedWebp(vp8x(0x12)), true); // animation + alpha
    assert.equal(isAnimatedWebp(vp8x(0x10)), false); // alpha only
    assert.equal(isAnimatedWebp(Buffer.from('RIFFxxxxWEBPVP8 ' + 'x'.repeat(30), 'latin1')), false);
  });

  it('detects APNG (acTL before IDAT) and ignores a normal PNG', () => {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const chunk = (type) => Buffer.concat([Buffer.alloc(4), Buffer.from(type, 'latin1'), Buffer.alloc(8)]);
    assert.equal(isAnimatedPng(Buffer.concat([sig, chunk('IHDR'), chunk('acTL'), chunk('IDAT')])), true);
    assert.equal(isAnimatedPng(Buffer.concat([sig, chunk('IHDR'), chunk('IDAT'), chunk('IEND')])), false);
  });

  it('animated images are returned untouched without even loading the compressor', async () => {
    const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const chunk = (type) => Buffer.concat([Buffer.alloc(4), Buffer.from(type, 'latin1'), Buffer.alloc(8)]);
    const apng = Buffer.concat([sig, chunk('IHDR'), chunk('acTL'), chunk('IDAT')]);
    let loaded = false;
    const r = await compressImage(file(apng, 'image/png'), { loadSharp: async () => { loaded = true; return null; } });
    assert.equal(loaded, false);
    assert.equal(r.compressed, false);
    assert.equal(r.reason, 'animated');
    assert.equal(r.buffer, apng);
    assert.equal(r.error, undefined);
  });

  it('if the compressor cannot be loaded the original upload is kept (uploads keep working)', async () => {
    const original = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const warn = console.warn;
    console.warn = () => {};
    try {
      const r = await compressImage(file(original, 'image/jpeg'), {
        loadSharp: async () => { throw new Error('Cannot find package sharp'); },
      });
      assert.equal(r.compressed, false);
      assert.equal(r.reason, 'compressor-unavailable');
      assert.equal(r.buffer, original);
      assert.equal(r.mimetype, 'image/jpeg');
      assert.equal(r.error, undefined);
    } finally {
      console.warn = warn;
    }
  });
});

// ======================================================================
describe('validation still rejects disguised files (existing behaviour, unchanged)', () => {
  const cases = [
    ['plain text declared as JPEG', Buffer.from('this is not an image at all'), 'image/jpeg'],
    ['HTML declared as PNG', Buffer.from('<html><script>alert(1)</script></html>'), 'image/png'],
    ['SVG declared as WebP', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/webp'],
    ['Windows executable declared as JPEG', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'image/jpeg'],
    ['GIF declared as PNG', Buffer.from('GIF89a' + 'x'.repeat(100), 'latin1'), 'image/png'],
    ['empty file', Buffer.alloc(0), 'image/jpeg'],
  ];
  for (const [name, buf, mime] of cases) {
    it(name, () => assert.ok(validateImageFile(file(buf, mime))));
  }
  it('real PNG bytes declared as image/jpeg (type mismatch)', REAL, async () => {
    const png = await transparentPng(50, 50);
    assert.ok(validateImageFile(file(png, 'image/jpeg')));
  });
  it('a file over 4 MB is rejected before compression', () => {
    const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(MAX_IMAGE_BYTES + 10)]);
    assert.match(validateImageFile(file(big, 'image/jpeg')), /too large/i);
  });
});

// ======================================================================
describe('real sharp: compression', REAL, () => {
  it('JPEG close to the 4 MB limit: accepted, resized to 2000px, same format, much smaller', async () => {
    const original = await noiseJpeg(3000, 2000, 90);
    assert.ok(original.length > 3.5 * 1024 * 1024 && original.length <= MAX_IMAGE_BYTES, `fixture size ${original.length}`);
    const f = file(original, 'image/jpeg');
    assert.equal(validateImageFile(f), null);

    const r = await compressImage(f);
    assert.equal(r.error, undefined);
    assert.equal(r.compressed, true);
    assert.equal(r.reason, 'resized');
    assert.equal(r.mimetype, 'image/jpeg');
    assert.equal(detectImageType(r.buffer), 'image/jpeg');
    assert.ok(r.finalBytes < r.originalBytes * 0.8, `${r.originalBytes} -> ${r.finalBytes}`);
    assert.ok(r.finalBytes <= MAX_IMAGE_BYTES);
    const m = await sharp(r.buffer).metadata();
    assert.equal(m.format, 'jpeg');
    assert.equal(Math.max(m.width, m.height), MAX);
    assert.ok(Math.abs(m.width / m.height - 3000 / 2000) < 0.01, 'aspect ratio preserved');
  });

  it('visual quality is preserved (low error vs the original at the same size)', async () => {
    const original = await sceneJpeg(3000, 2000, 95);
    const r = await compressImage(file(original, 'image/jpeg'));
    assert.equal(r.compressed, true);
    const mae = await meanAbsError(original, r.buffer, r.width, r.height);
    assert.ok(mae < 2.5, `mean absolute error ${mae.toFixed(2)} (0-255 scale)`);
  });

  it('PNG transparency is preserved (resized lossless PNG)', async () => {
    const original = await transparentPng(2600, 1800);
    const r = await compressImage(file(original, 'image/png'));
    assert.equal(r.error, undefined);
    assert.equal(r.mimetype, 'image/png');
    assert.equal(detectImageType(r.buffer), 'image/png');
    const m = await sharp(r.buffer).metadata();
    assert.equal(m.format, 'png');
    assert.equal(m.hasAlpha, true);
    assert.equal(Math.max(m.width, m.height), MAX);
    assert.equal(await alphaAt(r.buffer, 2, 2), 0, 'corner stays fully transparent');
    assert.equal(await alphaAt(r.buffer, Math.floor(m.width / 2), Math.floor(m.height / 2)), 255, 'centre stays opaque');
  });

  it('WebP transparency is preserved', async () => {
    const original = await transparentWebp(2400, 1600);
    const r = await compressImage(file(original, 'image/webp'));
    assert.equal(r.error, undefined);
    assert.equal(r.mimetype, 'image/webp');
    assert.equal(detectImageType(r.buffer), 'image/webp');
    const m = await sharp(r.buffer).metadata();
    assert.equal(m.format, 'webp');
    assert.equal(m.hasAlpha, true);
    assert.equal(await alphaAt(r.buffer, 2, 2), 0);
    assert.equal(await alphaAt(r.buffer, Math.floor(m.width / 2), Math.floor(m.height / 2)), 255);
  });

  it('small images are never enlarged and keep their dimensions', async () => {
    for (const [mime, make] of [
      ['image/jpeg', () => sceneJpeg(600, 400, 98)],
      ['image/png', () => transparentPng(500, 300)],
      ['image/webp', () => transparentWebp(500, 300)],
    ]) {
      const original = await make();
      const before = await sharp(original).metadata();
      const r = await compressImage(file(original, mime));
      assert.equal(r.error, undefined);
      assert.equal(r.mimetype, mime);
      const after = await sharp(r.buffer).metadata();
      assert.equal(after.width, before.width, mime);
      assert.equal(after.height, before.height, mime);
      assert.ok(r.finalBytes <= r.originalBytes, mime);
    }
  });

  it('the format and MIME type never change (no silent conversion)', async () => {
    const inputs = [
      ['image/jpeg', 'jpeg', await sceneJpeg(2500, 1700)],
      ['image/png', 'png', await transparentPng(2500, 1700)],
      ['image/webp', 'webp', await transparentWebp(2500, 1700)],
    ];
    for (const [mime, fmt, buf] of inputs) {
      const r = await compressImage(file(buf, mime));
      assert.equal(r.mimetype, mime);
      assert.equal(detectImageType(r.buffer), mime);
      assert.equal((await sharp(r.buffer).metadata()).format, fmt);
    }
  });

  it('already-optimised images are not compressed again (original bytes kept)', async () => {
    for (const [mime, buf] of [
      ['image/jpeg', await sceneJpeg(3000, 2000, 95)],
      ['image/png', await transparentPng(2600, 1800)],
      ['image/webp', await transparentWebp(2400, 1600)],
    ]) {
      const first = await compressImage(file(buf, mime));
      const second = await compressImage(file(first.buffer, mime));
      assert.equal(second.compressed, false, mime);
      assert.equal(second.reason, 'already-optimised', mime);
      assert.ok(second.buffer.equals(first.buffer), `${mime}: bytes unchanged on re-upload`);
    }
  });

  it('EXIF orientation is applied (not lost when metadata is stripped)', async () => {
    const original = await noiseJpeg(3000, 2000, 90, 6); // stored landscape, displayed portrait
    const before = await sharp(original).metadata();
    assert.equal(before.orientation, 6);
    const r = await compressImage(file(original, 'image/jpeg'));
    const m = await sharp(r.buffer).metadata();
    assert.ok(m.height > m.width, `now upright (${m.width}x${m.height})`);
    assert.equal(m.height, MAX);
    assert.equal(m.orientation, undefined, 'no stale orientation tag');
  });
});

// ======================================================================
describe('real sharp: invalid, corrupt and hostile images are rejected', REAL, () => {
  const rejected = async (buf, mime) => {
    const f = file(buf, mime);
    assert.equal(validateImageFile(f), null, 'passes the magic-byte check, so compression must catch it');
    const r = await compressImage(f);
    assert.ok(r.error, 'has an error');
    assert.equal(r.compressed, false);
    return r;
  };

  it('truncated JPEG', async () => {
    const good = await sceneJpeg(1600, 1000, 95);
    await rejected(good.subarray(0, Math.floor(good.length * 0.5)), 'image/jpeg');
  });
  it('JPEG header followed by garbage', async () => {
    await rejected(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('not really jpeg data '.repeat(200))]), 'image/jpeg');
  });
  it('truncated PNG', async () => {
    const good = await transparentPng(1500, 1000);
    await rejected(good.subarray(0, Math.floor(good.length * 0.6)), 'image/png');
  });
  it('PNG signature followed by garbage', async () => {
    await rejected(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('garbage '.repeat(300))]), 'image/png');
  });
  it('truncated WebP', async () => {
    const good = await transparentWebp(1500, 1000);
    await rejected(good.subarray(0, Math.floor(good.length * 0.5)), 'image/webp');
  });
  it('decompression bomb (tiny file, > 50 megapixels) is rejected with a dimensions message', async () => {
    const side = 7300; // 53.3 MP > 50 MP limit
    const bomb = await sharp({ create: { width: side, height: side, channels: 3, background: { r: 128, g: 128, b: 128 } } }).png({ compressionLevel: 9 }).toBuffer();
    assert.ok(bomb.length < MAX_IMAGE_BYTES, `bomb is only ${bomb.length} bytes`);
    const r = await rejected(bomb, 'image/png');
    assert.match(r.error, /dimensions are too large/i);
  });
});
