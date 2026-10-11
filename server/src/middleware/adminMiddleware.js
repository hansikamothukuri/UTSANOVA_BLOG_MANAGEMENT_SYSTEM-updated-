import db from '../config/db.js';
import { sendError } from '../utils/apiResponse.js';
import { isOwnerFlag, isOwnerIdentity, resolveAccess } from '../utils/permissions.js';

const isDelegatedRow = (row) => row && (row.is_delegated === 1 || row.is_delegated === true || row.is_delegated === '1');
const isInactiveRow = (row) => row && (row.is_active === 0 || row.is_active === false || row.is_active === '0');

/**
 * Runs after authMiddleware (verified Firebase token in req.user). Establishes req.admin (DB row)
 * and req.access ({ role, isOwner, permissions }). It only answers "is this a known, active admin
 * account?" - WHAT the account may do is enforced per route by requirePermission / requireOwner.
 */
export const adminMiddleware = async (req, res, next) => {
  try {
    const uid = req.user?.uid;

    if (!uid) {
      return sendError(res, 'Unauthorized: User identifier missing', 401);
    }

    const owner = isOwnerIdentity(req.user);
    let [rows] = await db.query('SELECT * FROM admins WHERE firebase_uid = ?', [uid]);

    if ((!rows || rows.length === 0) && !owner && req.user?.email && req.user.email_verified === true) {
      // Legacy linking of a pre-existing admin row (e.g. seeded with a placeholder UID) to the real
      // Firebase UID. SECURITY: only for a Firebase-VERIFIED email, only when exactly one row matches,
      // and never for delegated (owner-provisioned), disabled or OWNER rows (an email can never confer ownership). An unverified email claim can
      // never take over an admin record.
      const [emailRows] = await db.query('SELECT * FROM admins WHERE email = ?', [req.user.email]);
      if (emailRows && emailRows.length === 1 && !isDelegatedRow(emailRows[0]) && !isInactiveRow(emailRows[0]) && !isOwnerFlag(emailRows[0])) {
        await db.query('UPDATE admins SET firebase_uid = ? WHERE email = ?', [uid, req.user.email]);
        rows = [{ ...emailRows[0], firebase_uid: uid }];
        console.log(`[adminMiddleware] Linked verified Firebase UID '${uid}' to legacy admin record`);
      }
    }

    const row = rows && rows.length > 0 ? rows[0] : null;

    let permissionRows = [];
    if (row && isDelegatedRow(row) && !owner && !isOwnerFlag(row)) {
      [permissionRows] = await db.query('SELECT permission FROM admin_permissions WHERE admin_id = ?', [row.id]);
    }

    const access = resolveAccess({ user: req.user, adminRow: row, permissionRows });

    if (!access) {
      console.warn(`[adminMiddleware] UID '${uid}' is not an administrator account.`);
      return sendError(res, 'Forbidden: You do not have administrator permissions for Utsanova Blog System', 403);
    }
    if (access.disabled) {
      return sendError(res, 'Forbidden: This administrator account has been disabled', 403);
    }

    req.admin =
      row ||
      // A bootstrap owner (OWNER_FIREBASE_UID) needs no DB row (cannot be locked out by a migration/data problem).
      { id: null, firebase_uid: uid, email: req.user.email || null, name: req.user.name || 'Owner', is_delegated: 0, is_active: 1, is_owner: 1 };
    req.access = access;
    return next();
  } catch (error) {
    console.error('[adminMiddleware Error]:', error.message);
    return sendError(res, 'Error verifying administrator authorization', 500);
  }
};
