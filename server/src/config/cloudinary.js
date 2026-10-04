import { v2 as cloudinary } from 'cloudinary';

const getCloudinaryClient = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    const error = new Error('Cloudinary image uploads are not configured on the server.');
    error.statusCode = 503;
    throw error;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return cloudinary;
};

export const uploadImageToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const client = getCloudinaryClient();
    const stream = client.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || 'utsanova-blog',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (!result?.secure_url || !result.public_id) {
          reject(new Error('Cloudinary did not return image metadata.'));
          return;
        }
        resolve({ image_url: result.secure_url, image_public_id: result.public_id });
      }
    );

    stream.end(buffer);
  });

export const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  const result = await getCloudinaryClient().uploader.destroy(publicId, {
    invalidate: true,
    resource_type: 'image',
  });

  if (!['ok', 'not found'].includes(result?.result)) {
    throw new Error('Cloudinary did not confirm image deletion.');
  }
};