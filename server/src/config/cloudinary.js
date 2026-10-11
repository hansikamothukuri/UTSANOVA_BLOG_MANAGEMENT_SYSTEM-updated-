import { v2 as cloudinary } from 'cloudinary';

/**
 * Cloudinary is configured lazily from backend environment variables only.
 * The API secret never leaves the server and is never sent to the browser.
 *
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   CLOUDINARY_FOLDER (optional, default "utsanova-blog")
 */
export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

let configured = false;

export const getCloudinary = () => {
  if (!isCloudinaryConfigured()) {
    const err = new Error(
      'Image uploads are not configured on the server (missing Cloudinary environment variables).'
    );
    err.statusCode = 503;
    err.expose = true;
    throw err;
  }
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    configured = true;
  }
  return cloudinary;
};

export const CLOUDINARY_FOLDER = () => process.env.CLOUDINARY_FOLDER || 'utsanova-blog';
