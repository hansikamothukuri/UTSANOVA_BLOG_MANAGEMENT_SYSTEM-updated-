/**
 * Image upload validation (server side - never trust the browser's checks).
 * Allowed: JPG/JPEG, PNG, WebP. The declared MIME type AND the file's real
 * signature ("magic bytes") must agree, so a renamed .exe/.html/.svg is rejected.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB (Vercel serverless request bodies are capped at ~4.5 MB)
export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const startsWith = (buf, bytes, offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

export const detectImageType = (buf) => {
  if (!Buffer.isBuffer(buf)) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  // WebP: "RIFF" .... "WEBP"
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
};

/** Returns an error message string, or null when the file is acceptable. */
export const validateImageFile = (file) => {
  if (!file || !file.buffer) return 'No image data received.';
  if (file.size > MAX_IMAGE_BYTES || file.buffer.length > MAX_IMAGE_BYTES) {
    return `Image is too large. Maximum size is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`;
  }
  if (file.buffer.length === 0) return 'The selected image file is empty.';
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return 'Unsupported image type. Please upload a JPG, JPEG, PNG or WebP image.';
  }
  const detected = detectImageType(file.buffer);
  if (!detected || detected !== file.mimetype) {
    return 'The file content is not a valid JPG, PNG or WebP image.';
  }
  return null;
};
