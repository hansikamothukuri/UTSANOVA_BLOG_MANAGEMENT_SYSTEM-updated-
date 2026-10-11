/**
 * Server-side image compression for blog images, run AFTER validateImageFile() and BEFORE the
 * buffer is sent to Cloudinary (see blogController create/update).
 *
 * Policy
 *  - Same format in, same format out (JPEG -> JPEG, PNG -> PNG, WebP -> WebP). Nothing is
 *    silently converted, so the MIME type and extension of the stored image stay correct, and
 *    PNG/WebP transparency is preserved.
 *  - The longest side is limited to MAX_DIMENSION px; smaller images are never enlarged.
 *  - EXIF orientation is applied before metadata is stripped, so photos do not end up rotated.
 *  - The re-encoded file is only used when it is clearly better: it must be smaller, and either
 *    the image was resized or at least MIN_SAVINGS smaller. Otherwise the ORIGINAL bytes are kept,
 *    so re-uploading an already-optimised image does not lose quality again.
 *  - Animated images (animated WebP / APNG) are left untouched (re-encoding would drop frames).
 *  - Undecodable / truncated images and decompression bombs are rejected with a clear message.
 *  - If the `sharp` package cannot be loaded at all (not installed / no native binary for the
 *    platform), the original validated file is uploaded unchanged and a warning is logged, so
 *    uploads keep working exactly as before.
 *
 * The 4 MB upload limit and the magic-byte validation are unchanged (see imageValidation.js).
 */

export const IMAGE_COMPRESSION = {
  MAX_DIMENSION: 2000, // px, longest side (blog pages render at <= ~900 css px, i.e. 2x for retina)
  MAX_INPUT_PIXELS: 50_000_000, // ~50 MP: protects against decompression bombs
  JPEG_QUALITY: 82,
  WEBP_QUALITY: 82,
  MIN_SAVINGS: 0.1, // keep the original unless the new file is at least 10% smaller (or resized)
};

const FORMAT_BY_MIME = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

const MSG_CORRUPT = 'The image appears to be corrupt or could not be processed. Please choose a different image.';
const MSG_TOO_MANY_PIXELS = `The image dimensions are too large. Please use an image under ${
  IMAGE_COMPRESSION.MAX_INPUT_PIXELS / 1_000_000
} megapixels.`;

let sharpPromise = null;
const defaultLoadSharp = () => {
  if (!sharpPromise) sharpPromise = import('sharp').then((m) => m.default || m);
  return sharpPromise;
};

let warnedUnavailable = false;

/** True for WebP files with the animation flag (VP8X chunk, bit 1 of the flags byte). */
export const isAnimatedWebp = (buf) =>
  buf.length > 20 && buf.toString('latin1', 12, 16) === 'VP8X' && (buf[20] & 0x02) !== 0;

/** True for APNG: an "acTL" chunk that appears before the first "IDAT" chunk. */
export const isAnimatedPng = (buf) => {
  const actl = buf.indexOf('acTL', 8, 'latin1');
  if (actl === -1) return false;
  const idat = buf.indexOf('IDAT', 8, 'latin1');
  return idat === -1 || actl < idat;
};

const isAnimated = (buf, mime) =>
  (mime === 'image/webp' && isAnimatedWebp(buf)) || (mime === 'image/png' && isAnimatedPng(buf));

const applyEncoder = (pipeline, mime) => {
  if (mime === 'image/jpeg') {
    return pipeline.jpeg({ quality: IMAGE_COMPRESSION.JPEG_QUALITY, mozjpeg: true });
  }
  if (mime === 'image/png') {
    // Lossless (no palette quantisation): keeps every pixel and the alpha channel intact.
    return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  }
  return pipeline.webp({ quality: IMAGE_COMPRESSION.WEBP_QUALITY, effort: 4 });
};

/**
 * @param {{ buffer: Buffer, mimetype: string }} file  an already validated upload (validateImageFile)
 * @param {{ loadSharp?: () => Promise<Function> }} [deps]  override the sharp loader (tests)
 * @returns {Promise<{
 *   buffer: Buffer, mimetype: string, compressed: boolean, reason: string|null,
 *   originalBytes: number, finalBytes: number, width?: number, height?: number, error?: string
 * }>}  `error` is set (and the image must be rejected) for corrupt / oversized-pixel images.
 */
export const compressImage = async (file, deps = {}) => {
  const loadSharp = deps.loadSharp || defaultLoadSharp;
  const original = file.buffer;
  const mime = file.mimetype;
  const kept = (reason, extra = {}) => ({
    buffer: original,
    mimetype: mime,
    compressed: false,
    reason,
    originalBytes: original.length,
    finalBytes: original.length,
    ...extra,
  });

  if (isAnimated(original, mime)) return kept('animated');

  let sharp;
  try {
    sharp = await loadSharp();
  } catch (err) {
    if (!warnedUnavailable) {
      warnedUnavailable = true;
      console.warn(
        '[imageCompression] "sharp" could not be loaded - uploading images WITHOUT compression. ' +
          'Run `npm install` to install it.',
        err?.message || err
      );
    }
    return kept('compressor-unavailable');
  }

  const inputOptions = { failOn: 'warning', limitInputPixels: IMAGE_COMPRESSION.MAX_INPUT_PIXELS };
  const expectedFormat = FORMAT_BY_MIME[mime];

  try {
    const meta = await sharp(original, inputOptions).metadata();
    if (meta.format !== expectedFormat) return { ...kept('format-mismatch'), error: MSG_CORRUPT };

    const { MAX_DIMENSION, MIN_SAVINGS } = IMAGE_COMPRESSION;
    const needsResize = Math.max(meta.width || 0, meta.height || 0) > MAX_DIMENSION;

    const pipeline = sharp(original, inputOptions)
      .rotate() // apply EXIF orientation (metadata is stripped below)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
    const { data, info } = await applyEncoder(pipeline, mime).toBuffer({ resolveWithObject: true });

    const smaller = data.length < original.length;
    const savedEnough = 1 - data.length / original.length >= MIN_SAVINGS;
    if (!smaller || !(needsResize || savedEnough)) {
      return kept('already-optimised', { width: meta.width, height: meta.height });
    }

    return {
      buffer: data,
      mimetype: mime, // never changed: same format in, same format out
      compressed: true,
      reason: needsResize ? 'resized' : 'recompressed',
      originalBytes: original.length,
      finalBytes: data.length,
      width: info.width,
      height: info.height,
    };
  } catch (err) {
    const message = String(err?.message || '');
    if (/pixel limit/i.test(message)) return { ...kept('too-many-pixels'), error: MSG_TOO_MANY_PIXELS };
    return { ...kept('undecodable'), error: MSG_CORRUPT };
  }
};

export default compressImage;
