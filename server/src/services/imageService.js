import { getCloudinary, CLOUDINARY_FOLDER } from '../config/cloudinary.js';

/**
 * Thin wrapper around Cloudinary. Only the returned URL + public ID are stored in MySQL.
 */
export const imageService = {
  /**
   * Uploads an in-memory image buffer to Cloudinary.
   * @returns {{ url: string, publicId: string }}
   */
  async upload(buffer) {
    const cloudinary = getCloudinary();
    try {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: CLOUDINARY_FOLDER(),
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
            unique_filename: true,
            overwrite: false,
          },
          (error, res) => (error ? reject(error) : resolve(res))
        );
        stream.end(buffer);
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      console.error('[Cloudinary Upload Error]:', error?.message || error);
      const err = new Error('Image upload failed. Please try again in a moment.');
      err.statusCode = 502;
      err.expose = true;
      throw err;
    }
  },

  /**
   * Best-effort delete. Never throws: a failed cleanup must not fail the user's request
   * (it is logged so orphaned files can be found in the Cloudinary console).
   */
  async remove(publicId) {
    if (!publicId) return false;
    try {
      const cloudinary = getCloudinary();
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });
      return result?.result === 'ok';
    } catch (error) {
      console.error(`[Cloudinary Delete Error] public_id=${publicId}:`, error?.message || error);
      return false;
    }
  },
};

export default imageService;
