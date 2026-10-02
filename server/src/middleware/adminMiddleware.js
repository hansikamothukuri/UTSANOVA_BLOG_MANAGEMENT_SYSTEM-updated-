import db from '../config/db.js';
import { sendError } from '../utils/apiResponse.js';

export const adminMiddleware = async (req, res, next) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return sendError(res, 'Unauthorized: User identifier missing', 401);
    }

    let [rows] = await db.query('SELECT * FROM admins WHERE firebase_uid = ?', [uid]);

    if (!rows || rows.length === 0) {
      // If UID not found yet, check by verified token email:
      if (req.user?.email) {
        const [emailRows] = await db.query('SELECT * FROM admins WHERE email = ?', [req.user.email]);
        if (emailRows && emailRows.length > 0) {
          // Link this real Firebase UID to the admin record
          await db.query('UPDATE admins SET firebase_uid = ? WHERE email = ?', [uid, req.user.email]);
          rows = emailRows;
          console.log(`[adminMiddleware] Linked live Firebase UID '${uid}' to admin email '${req.user.email}'`);
        }
      }
    }

    if (!rows || rows.length === 0) {
      console.warn(`[adminMiddleware] UID '${uid}' (${req.user?.email}) not found in admins table.`);
      return sendError(res, 'Forbidden: You do not have administrator permissions for Utsanova Blog System', 403);
    }

    req.admin = rows[0];
    return next();
  } catch (error) {
    console.error('[adminMiddleware Error]:', error.message);
    return sendError(res, 'Error verifying administrator authorization', 500);
  }
};
