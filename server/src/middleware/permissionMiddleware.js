import { sendError } from '../utils/apiResponse.js';
import { hasPermission } from '../utils/permissions.js';

/** Must run after adminMiddleware. Allows the request only if the account holds `code`. */
export const requirePermission = (code) => (req, res, next) => {
  if (hasPermission(req.access, code)) return next();
  return sendError(res, `Forbidden: your account does not have the ${code} permission`, 403, {
    code: 'PERMISSION_DENIED',
    required: code,
  });
};

/** Allows the request if the account holds at least one of the listed permissions. */
export const requireAnyPermission = (...codes) => (req, res, next) => {
  if (codes.some((c) => hasPermission(req.access, c))) return next();
  return sendError(res, `Forbidden: requires one of ${codes.join(', ')}`, 403, {
    code: 'PERMISSION_DENIED',
    required: codes,
  });
};

/** Owner-only functionality (user management). Delegated and legacy admins are always rejected. */
export const requireOwner = (req, res, next) => {
  if (req.access?.isOwner) return next();
  return sendError(res, 'Forbidden: only an owner can perform this action', 403, { code: 'OWNER_ONLY' });
};
