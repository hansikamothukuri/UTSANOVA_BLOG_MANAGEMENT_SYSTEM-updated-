import { verifyIdToken } from '../config/firebase.js';
import { sendError } from '../utils/apiResponse.js';

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication token missing or invalid format. Expected Bearer token.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Authentication token not found in Authorization header.', 401);
    }

    const decoded = await verifyIdToken(token);
    req.user = decoded;
    return next();
  } catch (error) {
    console.error('[authMiddleware Error]:', error.message);
    return sendError(res, 'Unauthorized: Invalid or expired authentication token', 401);
  }
};

/**
 * Same verification as authMiddleware, but never rejects: a missing/invalid/expired token just
 * means "logged-out visitor" (req.user stays undefined). Used by public read endpoints that
 * personalise their response (e.g. "did I like this blog?"). Identity still comes ONLY from the
 * verified Firebase token.
 */
export const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) req.user = await verifyIdToken(token);
    }
  } catch (error) {
    req.user = undefined;
  }
  return next();
};
