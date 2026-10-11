import db from '../config/db.js';

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
   */
  async registerFromToken({ firebase_uid, email, name }) {
    const byUid = await this.findByFirebaseUID(firebase_uid);
    if (byUid) return { admin: byUid, created: false };

    // A row with this (Firebase-verified, unique) email but another/placeholder UID:
    // link it instead of inserting a second row (same behaviour as adminMiddleware).
    const [byEmail] = await db.query('SELECT * FROM admins WHERE email = ? LIMIT 1', [email]);
    if (byEmail.length > 0) {
      await db.query('UPDATE admins SET firebase_uid = ? WHERE id = ?', [firebase_uid, byEmail[0].id]);
      return { admin: { ...byEmail[0], firebase_uid }, created: false };
    }

    try {
      const [result] = await db.query(
        'INSERT INTO admins (firebase_uid, email, name) VALUES (?, ?, ?)',
        [firebase_uid, email, name]
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
