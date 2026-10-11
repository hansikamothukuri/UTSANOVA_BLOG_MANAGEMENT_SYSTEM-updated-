/**
 * Permission model (pure functions, no I/O).
 *
 * Access levels
 *  - owner         : an active admins row with is_owner = 1 (any number of owners), or a bootstrap owner
 *                    listed in OWNER_FIREBASE_UID. Full blog access + user management.
 *  - legacy_admin  : an admins row that existed before migration 004 (is_delegated = 0). Keeps full BLOG_*
 *                    access (exactly what it had before) but can NEVER manage users.
 *  - delegated     : an admins row with is_delegated = 1. Has exactly the BLOG_* codes stored in
 *                    admin_permissions; nothing else. A freshly self-registered account is delegated with
 *                    zero permissions.
 */
export const PERMISSIONS = Object.freeze({
  BLOG_READ: 'BLOG_READ',
  BLOG_CREATE: 'BLOG_CREATE',
  BLOG_UPDATE: 'BLOG_UPDATE',
  BLOG_DELETE: 'BLOG_DELETE',
});

export const ALL_PERMISSIONS = Object.freeze(Object.values(PERMISSIONS));

export const normalizeEmail = (value) => String(value ?? '').trim().toLowerCase();

/**
 * Bootstrap owners: Firebase UIDs listed in OWNER_FIREBASE_UID (comma separated). They are owners
 * by SERVER CONFIGURATION, need no DB row, are never written to the DB automatically and cannot be
 * demoted/disabled/deleted through the API - so the system can never end up with zero owners and an
 * operator can always recover. Every other owner is database-backed (admins.is_owner = 1).
 * An email address never grants ownership.
 */
export const getBootstrapOwnerUids = (env = process.env) =>
  String(env.OWNER_FIREBASE_UID || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

export const isBootstrapOwnerUid = (uid, env = process.env) => Boolean(uid) && getBootstrapOwnerUids(env).includes(uid);

/** Is the (Firebase-VERIFIED) token a bootstrap owner? (DB owners are resolved in resolveAccess.) */
export const isOwnerIdentity = (user, env = process.env) => Boolean(user && user.uid) && isBootstrapOwnerUid(user.uid, env);

/** Protective check on a DB row: bootstrap-owner rows are managed by server configuration only. */
export const isBootstrapOwnerRow = (row, env = process.env) => Boolean(row) && isBootstrapOwnerUid(row.firebase_uid, env);

const isTrue = (v) => v === true || v === 1 || v === '1';
const isFalse = (v) => v === false || v === 0 || v === '0';

/** Is this DB row flagged as a (database-backed) owner? */
export const isOwnerFlag = (row) => Boolean(row) && isTrue(row.is_owner);

/**
 * Builds the effective access for a verified token. Called on EVERY protected request, so a
 * promotion/demotion/disable in the database takes effect immediately.
 * Returns null when the account has no admin access at all, or { disabled: true } for a disabled account.
 * `permissionRows` = [{ permission }] from admin_permissions (only read for delegated accounts).
 */
export const resolveAccess = ({ user, adminRow, permissionRows = [], env = process.env }) => {
  if (isOwnerIdentity(user, env)) {
    return { role: 'owner', isOwner: true, isBootstrapOwner: true, permissions: [...ALL_PERMISSIONS] };
  }
  if (!adminRow) return null;
  if (isFalse(adminRow.is_active)) return { disabled: true, role: 'disabled', isOwner: false, permissions: [] };

  if (isOwnerFlag(adminRow)) {
    return { role: 'owner', isOwner: true, isBootstrapOwner: false, permissions: [...ALL_PERMISSIONS] };
  }
  if (isTrue(adminRow.is_delegated)) {
    const granted = new Set(permissionRows.map((r) => r.permission).filter((p) => ALL_PERMISSIONS.includes(p)));
    return { role: 'delegated', isOwner: false, permissions: ALL_PERMISSIONS.filter((p) => granted.has(p)) };
  }
  return { role: 'legacy_admin', isOwner: false, permissions: [...ALL_PERMISSIONS] };
};

export const hasPermission = (access, code) =>
  Boolean(access && !access.disabled && Array.isArray(access.permissions) && access.permissions.includes(code));

/** Validates a permission list from a request body. Returns { value: [...], error }. */
export const validatePermissionList = (input) => {
  if (!Array.isArray(input)) return { value: null, error: 'permissions must be an array of permission codes' };
  const seen = new Set();
  for (const item of input) {
    if (typeof item !== 'string' || !ALL_PERMISSIONS.includes(item)) {
      return { value: null, error: `Unknown permission code. Allowed: ${ALL_PERMISSIONS.join(', ')}` };
    }
    seen.add(item);
  }
  return { value: ALL_PERMISSIONS.filter((p) => seen.has(p)), error: null };
};
