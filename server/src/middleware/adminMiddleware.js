import db from '../config/db.js';
import { sendError } from '../utils/apiResponse.js';

export const adminMiddleware = async (req, res, next) => {
  try {
    const uid = req.user?.uid;

    console.log('[adminMiddleware] Firebase user:', {
      uid,
      email: req.user?.email,
    });

    if (!uid) {
      return sendError(res, 'Unauthorized: User identifier missing', 401);
    }

    let [rows] = await db.query(
      'SELECT * FROM admins WHERE firebase_uid = ?',
      [uid]
    );

    console.log('[adminMiddleware] UID lookup:', {
      uid,
      rowsFound: rows?.length || 0,
    });

    if (!rows || rows.length === 0) {
      if (req.user?.email) {
        const [emailRows] = await db.query(
          'SELECT * FROM admins WHERE email = ?',
          [req.user.email]
        );

        console.log('[adminMiddleware] Email lookup:', {
          email: req.user.email,
          rowsFound: emailRows?.length || 0,
        });

        if (emailRows && emailRows.length > 0) {
          await db.query(
            'UPDATE admins SET firebase_uid = ? WHERE email = ?',
            [uid, req.user.email]
          );

          rows = emailRows;

          console.log(
            `[adminMiddleware] Linked Firebase UID '${uid}' to admin email '${req.user.email}'`
          );
        }
      }
    }

    if (!rows || rows.length === 0) {
      console.warn(
        `[adminMiddleware] UID '${uid}' (${req.user?.email}) not found in admins table.`
      );

      return sendError(
        res,
        'Forbidden: You do not have administrator permissions for Utsanova Blog System',
        403
      );
    }

    req.admin = rows[0];
    return next();
  } catch (error) {
    console.error('[adminMiddleware Error]:', error.message);
    return sendError(res, 'Error verifying administrator authorization', 500);
  }
};