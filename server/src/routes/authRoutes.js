import { Router } from 'express';
import adminService from '../services/adminService.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

/**
 * Register a new admin in the MySQL database
 * POST /api/auth/register-admin
 */
// SECURITY: this endpoint used to be public, so anyone could make themselves an admin.
// It is now disabled unless ADMIN_SELF_REGISTRATION=true, and even then it requires a
// verified Firebase ID token and registers ONLY the token's own uid/email.
const registrationGate = (req, res, next) => {
  if (String(process.env.ADMIN_SELF_REGISTRATION).toLowerCase() !== 'true') {
    return sendError(
      res,
      'Admin self-registration is disabled on this server. Set ADMIN_SELF_REGISTRATION=true to enable it.',
      403
    );
  }
  return next();
};

router.post('/register-admin', authMiddleware, async (req, res) => {
  try {
    // Identity comes ONLY from the verified Firebase ID token (set by authMiddleware).
    // Any firebase_uid / email sent in the request body is ignored on purpose.
    const firebase_uid = req.user.uid;
    const email = req.user.email;

    if (!firebase_uid || !email) {
      return sendError(res, 'Verified Firebase token has no UID/email; cannot register admin.', 400);
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Display name: the name typed in the form is only a label (not a security claim).
    // Fall back to the name claim in the token, then to the email prefix.
    const bodyName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const tokenName = typeof req.user.name === 'string' ? req.user.name.trim() : '';
    const name = (bodyName || tokenName || cleanEmail.split('@')[0]).slice(0, 255);

    const { admin, created } = await adminService.registerFromToken({
      firebase_uid,
      email: cleanEmail,
      name,
    });

    console.log(
      `[Auth API] Admin ${created ? 'registered' : 'already existed'} in MySQL: ${cleanEmail} (UID: ${firebase_uid})`
    );
    return sendSuccess(res, admin, created ? 201 : 200);
  } catch (error) {
    console.error('[Register Admin Error]:', error);
    return sendError(res, 'Failed to register admin in database', 500);
  }
});

export default router;
