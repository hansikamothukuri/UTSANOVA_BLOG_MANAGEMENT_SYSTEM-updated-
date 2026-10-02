import { sendError } from '../utils/apiResponse.js';

export const errorHandler = (err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);

  const statusCode = err.statusCode || (err.status ? Number(err.status) : 500);
  const hideDetails =
    statusCode >= 500 && (process.env.VERCEL || process.env.NODE_ENV === 'production');
  const message = hideDetails
    ? 'Internal server error occurred'
    : err.message || 'Internal server error occurred';

  return sendError(res, message, statusCode);
};

export const notFoundHandler = (req, res) => {
  return sendError(res, `API route not found: ${req.method} ${req.originalUrl}`, 404);
};
