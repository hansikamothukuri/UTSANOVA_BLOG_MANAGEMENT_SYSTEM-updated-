import multer from 'multer';
import { sendError } from '../utils/apiResponse.js';
import { MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '../utils/imageValidation.js';

// Memory storage: nothing is ever written to the server's filesystem (serverless friendly).
// The buffer is streamed straight to Cloudinary by imageService.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype)) {
      const err = new Error('Unsupported image type. Please upload a JPG, JPEG, PNG or WebP image.');
      err.code = 'UNSUPPORTED_IMAGE_TYPE';
      return cb(err);
    }
    return cb(null, true);
  },
});

const single = upload.single('image');

/**
 * Parses an optional multipart "image" file. JSON requests (no multipart body) pass straight
 * through untouched, so existing JSON clients keep working. Upload problems become clean 4xx
 * responses in the project's { success:false, message } format.
 */
export const optionalImageUpload = (req, res, next) => {
  single(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, `Image is too large. Maximum size is ${MAX_IMAGE_BYTES / (1024 * 1024)} MB.`, 413);
    }
    if (err.code === 'UNSUPPORTED_IMAGE_TYPE') {
      return sendError(res, err.message, 415);
    }
    if (err instanceof multer.MulterError) {
      return sendError(res, 'Invalid upload. Send a single image in the "image" field.', 400);
    }
    return next(err);
  });
};
