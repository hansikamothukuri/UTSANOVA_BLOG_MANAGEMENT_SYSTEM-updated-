import db from '../config/db.js';
import { httpError, withMigrationHint } from '../utils/httpError.js';

export const adminService = {
  /**
   * Find admin by Firebase UID
   */
  async findByFirebaseUID(uid) {
    const [rows] = await db.query('SELECT * FROM admins WHERE firebase_uid = ?', [uid]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Add a new admin to MySQL
   */
  async addAdmin({ firebase_uid, email, name }) {
    const existing = await this.findByFirebaseUID(firebase_uid);
    if (existing) {
      return existing;
    }

    const sql = 'INSERT INTO admins (firebase_uid, email, name) VALUES (?, ?, ?)';
    const [result] = await db.query(sql, [firebase_uid, email, name || 'Utsanova Admin']);
    const insertId = result.insertId || result[0]?.insertId;

    const [created] = await db.query('SELECT * FROM admins WHERE id = ?', [insertId]);
    return created[0];
  },

  /**
   * Idempotent registration used by POST /api/auth/register-admin.
   * Callers must pass a UID/email taken from a VERIFIED Firebase ID token.
   * Returns { admin, created }. Never creates a duplicate row.
   *
   * SECURITY (migration 004):
   *  - an existing row with the same email is linked ONLY when Firebase reports the email as verified
   *    and the row is a legacy (non-delegated), active, non-owner admin; otherwise the request is a 409 conflict
   *    (no silent takeover, no duplicate row);
   *  - a brand-new account is stored as a delegated account with ZERO permissions. Only the owner can
   *    grant access (Manage Users).
   */
  async registerFromToken({ firebase_uid, email, name, emailVerified = false }) {
    const byUid = await this.findByFirebaseUID(firebase_uid);
    if (byUid) return { admin: byUid, created: false };

    const [byEmail] = await db.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
    if (byEmail.length > 0) {
      const row = byEmail[0];
      const delegated = Number(row.is_delegated) === 1;
      const inactive = row.is_active === 0 || row.is_active === false;
      const isOwnerRow = row.is_owner === 1 || row.is_owner === true || row.is_owner === '1';
      if (emailVerified === true && !delegated && !inactive && !isOwnerRow) {
        await db.query('UPDATE admins SET firebase_uid = ? WHERE id = ?', [firebase_uid, row.id]);
        return { admin: { ...row, firebase_uid }, created: false };
      }
      throw httpError(
        409,
        'An administrator record already exists for this email and cannot be linked to this sign-in. Verify the email address, or ask the owner to provision the account.',
        'ADMIN_EMAIL_CONFLICT'
      );
    }

    try {
      const [result] = await withMigrationHint(() =>
        db.query(
          'INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)',
          [firebase_uid, email, name, null]
        )
      );
      const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [result.insertId]);
      return { admin: rows[0], created: true };
    } catch (err) {
      // Two concurrent requests: the UNIQUE(firebase_uid) key rejected the second insert.
      if (err.code === 'ER_DUP_ENTRY') {
        const existing = await this.findByFirebaseUID(firebase_uid);
        if (existing) return { admin: existing, created: false };
      }
      throw err;
    }
  },

  /**
   * List all admins (Admin management)
   */
  async listAdmins() {
    const [rows] = await db.query('SELECT id, firebase_uid, email, name, created_at FROM admins ORDER BY created_at ASC');
    return rows;
  },
};

export default adminService;
