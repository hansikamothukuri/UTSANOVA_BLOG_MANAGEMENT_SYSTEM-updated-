import db from '../config/db.js';
import { firebaseAdminOps } from '../config/firebase.js';
import { httpError, withMigrationHint } from '../utils/httpError.js';
import {
  ALL_PERMISSIONS,
  getBootstrapOwnerUids,
  isBootstrapOwnerRow,
  isOwnerFlag,
  normalizeEmail,
  validatePermissionList,
} from '../utils/permissions.js';

// Replaceable in tests so no real Firebase account is ever created by the test-suite.
let authOps = firebaseAdminOps;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isDelegated = (row) => Number(row.is_delegated) === 1;
const isActive = (row) => !(row.is_active === 0 || row.is_active === false || row.is_active === '0');

const kindOf = (row) => (isOwnerFlag(row) || isBootstrapOwnerRow(row) ? 'owner' : isDelegated(row) ? 'delegated' : 'legacy_admin');

// Never exposes firebase_uid. Permissions shown for a legacy admin are what it effectively holds.
const toApiUser = (row, permissionRows) => {
  const kind = kindOf(row);
  const granted = permissionRows.filter((p) => Number(p.admin_id) === Number(row.id)).map((p) => p.permission);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    kind,
    is_active: isActive(row),
    is_owner: kind === 'owner',
    is_bootstrap_owner: isBootstrapOwnerRow(row),
    permissions: kind === 'delegated' ? ALL_PERMISSIONS.filter((p) => granted.includes(p)) : [...ALL_PERMISSIONS],
    created_at: row.created_at,
  };
};

// Bootstrap owners (OWNER_FIREBASE_UID) are managed by server configuration, never through the API.
const assertNotBootstrapOwner = (row) => {
  if (isBootstrapOwnerRow(row)) {
    throw httpError(403, 'This owner is defined by server configuration (OWNER_FIREBASE_UID) and cannot be changed here', 'BOOTSTRAP_OWNER_PROTECTED');
  }
};

const assertNotSelf = (row, actorUid, what) => {
  if (actorUid && row.firebase_uid === actorUid) throw httpError(400, `You cannot ${what} your own account`, 'SELF_ACTION');
};

/**
 * Locks every active DB owner row (SELECT ... FOR UPDATE) for the rest of the transaction, so two
 * concurrent demotions/removals are serialised and the last-owner check below cannot be raced.
 * Returns the locked owner ids.
 */
const lockOwners = async (tx) => {
  const [rows] = await tx.query('SELECT id FROM admins WHERE is_owner = 1 AND is_active = 1 FOR UPDATE');
  return rows.map((r) => Number(r.id));
};

/**
 * Throws 409 if taking owner privileges away from `row` (demote / disable / delete) would leave the
 * system with no owner at all. Bootstrap owners (server config) always count as remaining owners.
 */
const assertNotLastOwner = (row, lockedOwnerIds) => {
  if (!(isOwnerFlag(row) && isActive(row))) return; // not an active DB owner: nothing is lost
  const remainingDbOwners = lockedOwnerIds.filter((id) => id !== Number(row.id)).length;
  if (remainingDbOwners === 0 && getBootstrapOwnerUids().length === 0) {
    throw httpError(409, 'This is the last owner. Promote another owner first.', 'LAST_OWNER');
  }
};

const reloadRow = async (tx, id) => {
  const [rows] = await tx.query('SELECT * FROM admins WHERE id = ?', [Number(id)]);
  if (!rows || rows.length === 0) throw httpError(404, 'User not found');
  return rows[0];
};

const parseId = (id) => {
  const numeric = Number(id);
  if (!Number.isInteger(numeric) || numeric < 1) throw httpError(404, 'User not found');
  return numeric;
};

const replacePermissions = async (tx, adminId, permissions, grantedBy) => {
  await tx.query('DELETE FROM admin_permissions WHERE admin_id = ?', [adminId]);
  for (const code of permissions) {
    await tx.query('INSERT INTO admin_permissions (admin_id, permission, granted_by) VALUES (?, ?, ?)', [adminId, code, grantedBy || null]);
  }
};

export const userService = {
  /** Test seam: swap the Firebase Admin operations. */
  setAuthProvider(provider) {
    authOps = provider || firebaseAdminOps;
  },

  async list() {
    return withMigrationHint(async () => {
      const [rows] = await db.query('SELECT * FROM admins ORDER BY id ASC');
      const [perms] = await db.query('SELECT admin_id, permission FROM admin_permissions');
      return rows.map((r) => toApiUser(r, perms));
    });
  },

  /**
   * Provisions a delegated admin through the Firebase Admin SDK (no password is chosen by the owner;
   * the person sets it via the returned one-time password-setup link). Never links to or adopts an
   * existing account: a duplicate email (DB or Firebase) is a 409.
   */
  async create({ email, name, permissions, actorUid }) {
    const cleanEmail = normalizeEmail(email);
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 255) throw httpError(400, 'A valid email address is required');
    const cleanName = (typeof name === 'string' && name.trim() ? name.trim() : cleanEmail.split('@')[0]).slice(0, 255);
    const { value: perms, error } = validatePermissionList(permissions ?? []);
    if (error) throw httpError(400, error);

    return withMigrationHint(async () => {
      const [existing] = await db.query('SELECT * FROM admins WHERE email = ?', [cleanEmail]);
      if (existing && existing.length > 0) throw httpError(409, 'An administrator account with this email already exists');

      if (await authOps.getUserByEmail(cleanEmail)) {
        throw httpError(409, 'A Firebase account with this email already exists. It is not adopted automatically; ask that person to use a different email or contact the owner.');
      }

      let fbUser;
      try {
        fbUser = await authOps.createUser({ email: cleanEmail, displayName: cleanName });
      } catch (err) {
        if (err.code === 'auth/email-already-exists') throw httpError(409, 'A Firebase account with this email already exists');
        throw err;
      }

      let adminId;
      try {
        adminId = await db.withTransaction(async (tx) => {
          const [result] = await tx.query(
            'INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)',
            [fbUser.uid, cleanEmail, cleanName, actorUid || 'owner']
          );
          await replacePermissions(tx, result.insertId, perms, actorUid);
          return result.insertId;
        });
      } catch (err) {
        // Keep Firebase and MySQL consistent: undo the account we just created.
        try { await authOps.deleteUser(fbUser.uid); } catch (cleanupErr) { console.error('[userService] Firebase cleanup failed:', cleanupErr.message); }
        throw err;
      }

      let passwordSetupLink = null;
      try {
        passwordSetupLink = await authOps.generatePasswordResetLink(cleanEmail);
      } catch (err) {
        console.error('[userService] Could not generate password setup link:', err.code || err.message);
      }

      const [rows] = await db.query('SELECT * FROM admins WHERE id = ?', [adminId]);
      const [permRows] = await db.query('SELECT admin_id, permission FROM admin_permissions WHERE admin_id = ?', [adminId]);
      return { user: toApiUser(rows[0], permRows), password_setup_link: passwordSetupLink };
    });
  },

  /** Replaces the permission set (saved in the database; enforced on every later request). */
  async setPermissions(id, permissions, actorUid) {
    const { value: perms, error } = validatePermissionList(permissions);
    if (error) throw httpError(400, error);
    const rowId = parseId(id);
    return withMigrationHint(async () => {
      await db.withTransaction(async (tx) => {
        const row = await reloadRow(tx, rowId);
        assertNotBootstrapOwner(row);
        if (isOwnerFlag(row)) throw httpError(409, 'Owners always have full access. Remove owner status first to give them limited permissions.', 'TARGET_IS_OWNER');
        // Setting explicit permissions turns a legacy full-access admin into a delegated one.
        await tx.query('UPDATE admins SET is_delegated = 1 WHERE id = ?', [row.id]);
        await replacePermissions(tx, row.id, perms, actorUid);
      });
      const [permRows] = await db.query('SELECT admin_id, permission FROM admin_permissions WHERE admin_id = ?', [rowId]);
      const [fresh] = await db.query('SELECT * FROM admins WHERE id = ?', [rowId]);
      return toApiUser(fresh[0], permRows);
    });
  },

  /**
   * Add / remove owner status. Only an owner can reach this (route guard) and is_owner is changed
   * here and nowhere else - it is never read from a request body elsewhere.
   * Guards: bootstrap owners are protected; the last owner cannot be demoted; the target must be active.
   */
  async setOwner(id, makeOwner, actorUid) {
    if (typeof makeOwner !== 'boolean') throw httpError(400, 'is_owner must be true or false');
    const rowId = parseId(id);
    return withMigrationHint(async () => {
      await db.withTransaction(async (tx) => {
        const lockedOwners = await lockOwners(tx);
        const row = await reloadRow(tx, rowId);
        assertNotBootstrapOwner(row);
        if (makeOwner) {
          if (!isActive(row)) throw httpError(409, 'A disabled account cannot be made an owner', 'TARGET_DISABLED');
          if (isOwnerFlag(row)) return; // already an owner (idempotent)
          await tx.query('UPDATE admins SET is_owner = 1 WHERE id = ?', [row.id]);
        } else {
          if (!isOwnerFlag(row)) return; // already not an owner (idempotent)
          assertNotLastOwner(row, lockedOwners);
          await tx.query('UPDATE admins SET is_owner = 0 WHERE id = ?', [row.id]);
        }
      });
      const [fresh] = await db.query('SELECT * FROM admins WHERE id = ?', [rowId]);
      const [permRows] = await db.query('SELECT admin_id, permission FROM admin_permissions WHERE admin_id = ?', [rowId]);
      return toApiUser(fresh[0], permRows);
    });
  },

  /** Disable / enable. The DB flag is enforced by the backend immediately; Firebase is updated too. */
  async setActive(id, active, actorUid) {
    if (typeof active !== 'boolean') throw httpError(400, 'is_active must be true or false');
    const rowId = parseId(id);
    return withMigrationHint(async () => {
      let target;
      await db.withTransaction(async (tx) => {
        const lockedOwners = await lockOwners(tx);
        const row = await reloadRow(tx, rowId);
        assertNotBootstrapOwner(row);
        if (!active) {
          assertNotSelf(row, actorUid, 'disable');
          assertNotLastOwner(row, lockedOwners);
        }
        await tx.query('UPDATE admins SET is_active = ? WHERE id = ?', [active ? 1 : 0, row.id]);
        target = row;
      });
      let warning = null;
      try {
        await authOps.setDisabled(target.firebase_uid, !active);
      } catch (err) {
        if (err.code !== 'auth/user-not-found') {
          warning = 'The account was updated in the database (access is enforced), but Firebase could not be updated.';
          console.error('[userService] Firebase setDisabled failed:', err.code || err.message);
        }
      }
      const [fresh] = await db.query('SELECT * FROM admins WHERE id = ?', [rowId]);
      const [permRows] = await db.query('SELECT admin_id, permission FROM admin_permissions WHERE admin_id = ?', [rowId]);
      return { user: toApiUser(fresh[0], permRows), warning };
    });
  },

  /** Removes the admin record (permissions cascade). Firebase account is deleted only if this system created it. */
  async remove(id, actorUid) {
    const rowId = parseId(id);
    return withMigrationHint(async () => {
      let target;
      await db.withTransaction(async (tx) => {
        const lockedOwners = await lockOwners(tx);
        const row = await reloadRow(tx, rowId);
        assertNotBootstrapOwner(row);
        assertNotSelf(row, actorUid, 'remove');
        assertNotLastOwner(row, lockedOwners);
        await tx.query('DELETE FROM admins WHERE id = ?', [row.id]);
        target = row;
      });
      let warning = null;
      if (target.created_by) {
        try {
          await authOps.deleteUser(target.firebase_uid);
        } catch (err) {
          if (err.code !== 'auth/user-not-found') {
            warning = 'Admin record removed; the Firebase account could not be deleted and may need manual cleanup.';
            console.error('[userService] Firebase deleteUser failed:', err.code || err.message);
          }
        }
      }
      return { id: rowId, warning };
    });
  },
};

export default userService;
