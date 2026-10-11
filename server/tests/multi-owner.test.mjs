/**
 * Multi-owner management tests (database-backed owners): 10+ owners, delegated admins, unauthorized
 * users, owner promotion/removal, last-owner protection, privilege-escalation attempts, permission
 * changes. Runs on the LOCAL JSON FALLBACK store in a temp directory (no MySQL / Firebase / network).
 *
 *   node --import ./server/tests/helpers/register-stubs.mjs --test server/tests/multi-owner.test.mjs
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
const srcUrl = (p) => new URL(`../src/${p}`, import.meta.url).href;
const BOOT_UID = 'bootstrap-owner-uid';
let tmpDir;
let m = {};

const mkRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = () => res;
  return res;
};
// Express-style chain runner: resolves { res, reached }
const run = async (chain, req) => {
  const res = mkRes();
  for (const step of chain) {
    let called = false;
    await step(req, res, () => { called = true; });
    if (!called) return { res, reached: false };
  }
  return { res, reached: true };
};
const asUid = (uid, extra = {}) => ({ user: { uid, email: `${uid}@example.com`, email_verified: true, ...extra } });
const ownerGate = (uid, extra) => run([m.adminMiddleware, m.requireOwner], asUid(uid, extra));
const rowOf = async (id) => (await m.db.query('SELECT * FROM admins WHERE id = ?', [id]))[0][0];

const fakeAuth = () => {
  const created = new Map();
  return {
    created,
    async getUserByEmail(email) { return [...created.values()].find((u) => u.email === email) || null; },
    async createUser({ email, displayName }) { const u = { uid: `fb-${created.size + 1}`, email, displayName }; created.set(u.uid, u); return u; },
    async setDisabled() {},
    async deleteUser(uid) { created.delete(uid); },
    async generatePasswordResetLink() { return 'https://example.invalid/reset'; },
  };
};
const mk = async (email, permissions = [], actor = BOOT_UID) =>
  (await m.userService.create({ email, name: email.split('@')[0], permissions, actorUid: actor })).user;
const uidOf = async (id) => (await rowOf(id)).firebase_uid;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'utsanova-owner-test-'));
  process.chdir(tmpDir);
  for (const k of Object.keys(process.env)) if (k.startsWith('DATABASE_')) delete process.env[k];
  delete process.env.VERCEL;
  process.env.NODE_ENV = 'test';
  process.env.OWNER_FIREBASE_UID = BOOT_UID;
  delete process.env.OWNER_EMAIL;

  m.db = (await import(srcUrl('config/db.js'))).default;
  m.adminMiddleware = (await import(srcUrl('middleware/adminMiddleware.js'))).adminMiddleware;
  Object.assign(m, await import(srcUrl('middleware/permissionMiddleware.js')));
  m.perm = await import(srcUrl('utils/permissions.js'));
  m.userService = (await import(srcUrl('services/userService.js'))).default;
  m.adminService = (await import(srcUrl('services/adminService.js'))).default;
  m.userService.setAuthProvider(fakeAuth());
  await m.db.initDB();
});

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('bootstrap owner', () => {
  it('is an owner with no DB row, can list users, and a new unknown user is NOT an owner', async () => {
    assert.equal((await ownerGate(BOOT_UID)).reached, true);
    assert.deepEqual((await m.userService.list()).filter((u) => u.is_owner), []); // nothing written to the DB
    assert.equal((await ownerGate('random-authenticated-user')).reached, false); // authenticated != owner
  });

  it('ownership cannot be obtained through an email, even one matching an owner row', async () => {
    const o = await mk('boss@example.com');
    await m.userService.setOwner(o.id, true, BOOT_UID);
    const attacker = await ownerGate('attacker-uid', { email: 'boss@example.com', email_verified: true });
    assert.equal(attacker.reached, false);
    assert.equal(attacker.res.statusCode, 403);
    await assert.rejects(
      m.adminService.registerFromToken({ firebase_uid: 'attacker-uid', email: 'boss@example.com', name: 'x', emailVerified: true }),
      (e) => e.statusCode === 409
    );
    await m.userService.setOwner(o.id, false, BOOT_UID);
  });
});

describe('ten or more designated owners', () => {
  const owners = [];
  it('promotes 12 users to owner and every one passes the owner gate', async () => {
    for (let i = 1; i <= 12; i++) {
      const u = await mk(`owner${i}@example.com`, i % 2 ? ['BLOG_READ'] : []);
      const promoted = await m.userService.setOwner(u.id, true, BOOT_UID);
      assert.equal(promoted.is_owner, true);
      assert.equal(promoted.kind, 'owner');
      owners.push(u.id);
    }
    assert.equal((await m.userService.list()).filter((u) => u.is_owner).length, 12);
    for (const id of owners) assert.equal((await ownerGate(await uidOf(id))).reached, true);
  });

  it('a DB owner can do everything: create, change permissions, promote, disable, delete', async () => {
    const actor = await uidOf(owners[0]);
    const created = (await m.userService.create({ email: 'by-owner@example.com', permissions: ['BLOG_READ'], actorUid: actor })).user;
    const upd = await m.userService.setPermissions(created.id, ['BLOG_READ', 'BLOG_UPDATE'], actor);
    assert.deepEqual(upd.permissions, ['BLOG_READ', 'BLOG_UPDATE']);
    assert.equal((await m.userService.setOwner(created.id, true, actor)).is_owner, true);
    assert.equal((await m.userService.setOwner(created.id, false, actor)).is_owner, false);
    assert.equal((await m.userService.setActive(created.id, false, actor)).user.is_active, false);
    await m.userService.remove(created.id, actor);
    assert.equal((await m.db.query('SELECT * FROM admins WHERE id = ?', [created.id]))[0].length, 0);
  });

  it('owners can list users', async () => {
    const list = await m.userService.list();
    assert.ok(list.length >= 12);
    assert.ok(list.every((u) => !('firebase_uid' in u)));
  });

  it('demoting an owner takes effect on the very next request; demoted owner can no longer manage users', async () => {
    const id = owners[5];
    const uid = await uidOf(id);
    assert.equal((await ownerGate(uid)).reached, true);
    await m.userService.setOwner(id, false, BOOT_UID);
    const after = await ownerGate(uid);
    assert.equal(after.reached, false);
    assert.equal(after.res.body.code, 'OWNER_ONLY');
    // ...but the account is not deleted and, with no permissions, has no blog powers either
    assert.equal((await run([m.adminMiddleware, m.requirePermission('BLOG_READ')], asUid(uid))).res.statusCode, 403);
  });

  it('a disabled owner loses owner access immediately', async () => {
    const id = owners[6];
    await m.userService.setActive(id, false, BOOT_UID);
    const r = await ownerGate(await uidOf(id));
    assert.equal(r.reached, false);
    assert.equal(r.res.statusCode, 403);
    await m.userService.setActive(id, true, BOOT_UID);
    assert.equal((await ownerGate(await uidOf(id))).reached, true);
  });
});

describe('delegated admins and unauthorized users cannot escalate', () => {
  let del, delUid;
  it('delegated admin (all four blog permissions) is still rejected by every owner-only gate', async () => {
    del = await mk('delegate@example.com', ['BLOG_READ', 'BLOG_CREATE', 'BLOG_UPDATE', 'BLOG_DELETE']);
    delUid = await uidOf(del.id);
    const r = await ownerGate(delUid);
    assert.equal(r.reached, false);
    assert.equal(r.res.body.code, 'OWNER_ONLY');
    assert.equal((await run([m.adminMiddleware, m.requirePermission('BLOG_DELETE')], asUid(delUid))).reached, true); // blog powers intact
  });

  it('is_owner in a request body or token claim does nothing (owner status is only read from the DB)', async () => {
    const r = await run([m.adminMiddleware, m.requireOwner], { ...asUid(delUid, { is_owner: true, admin: true, role: 'owner' }), body: { is_owner: true } });
    assert.equal(r.reached, false);
    assert.equal((await rowOf(del.id)).is_owner, 0);
  });

  it('legacy admins and unknown / unauthenticated-to-admin users are rejected', async () => {
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'utsanova_blog_data.json'), 'utf8'));
    data.admins.push({ id: 950, firebase_uid: 'legacy-uid', email: 'legacy2@example.com', name: 'L', is_delegated: 0, is_active: 1, is_owner: 0, created_by: null });
    fs.writeFileSync(path.join(tmpDir, 'utsanova_blog_data.json'), JSON.stringify(data));
    assert.equal((await ownerGate('legacy-uid')).reached, false);
    assert.equal((await ownerGate('nobody-uid')).res.statusCode, 403);
    const noUid = await run([m.adminMiddleware, m.requireOwner], { user: {} });
    assert.equal(noUid.res.statusCode, 401);
  });

  it('a self-registered account is not an owner and has no permissions', async () => {
    const { admin } = await m.adminService.registerFromToken({ firebase_uid: 'selfreg', email: 'selfreg@example.com', name: 'S', emailVerified: true });
    assert.equal(Number(admin.is_owner), 0);
    assert.equal((await ownerGate('selfreg')).reached, false);
  });

  it('an owner cannot be given partial permissions without removing owner status first (409)', async () => {
    const o = await mk('perm-owner@example.com');
    await m.userService.setOwner(o.id, true, BOOT_UID);
    await assert.rejects(m.userService.setPermissions(o.id, ['BLOG_READ'], BOOT_UID), (e) => e.statusCode === 409);
    await m.userService.setOwner(o.id, false, BOOT_UID);
    assert.deepEqual((await m.userService.setPermissions(o.id, ['BLOG_READ'], BOOT_UID)).permissions, ['BLOG_READ']);
  });
});

describe('permission grant / revoke by owners', () => {
  it('grant then revoke is saved and enforced on the next request', async () => {
    const u = await mk('grant@example.com', ['BLOG_READ']);
    const uid = await uidOf(u.id);
    const can = async (code) => (await run([m.adminMiddleware, m.requirePermission(code)], asUid(uid))).reached;
    assert.equal(await can('BLOG_DELETE'), false);
    await m.userService.setPermissions(u.id, ['BLOG_READ', 'BLOG_DELETE'], BOOT_UID);
    assert.equal(await can('BLOG_DELETE'), true);
    await m.userService.setPermissions(u.id, ['BLOG_READ'], BOOT_UID);
    assert.equal(await can('BLOG_DELETE'), false);
  });
});

describe('last-owner and bootstrap protection', () => {
  it('bootstrap-owner rows cannot be demoted, disabled, deleted or re-permissioned', async () => {
    const [ins] = await m.db.query('INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)', [BOOT_UID, 'boot@example.com', 'Boot', null]);
    for (const fn of [
      () => m.userService.setOwner(ins.insertId, false, 'x'),
      () => m.userService.setActive(ins.insertId, false, 'x'),
      () => m.userService.remove(ins.insertId, 'x'),
      () => m.userService.setPermissions(ins.insertId, [], 'x'),
    ]) await assert.rejects(fn, (e) => e.statusCode === 403 && e.code === 'BOOTSTRAP_OWNER_PROTECTED');
  });

  it('with NO bootstrap owner configured, the last DB owner cannot be demoted, disabled or deleted', async () => {
    const saved = process.env.OWNER_FIREBASE_UID;
    delete process.env.OWNER_FIREBASE_UID;
    try {
      const all = (await m.userService.list()).filter((u) => u.is_owner && u.is_active && !u.is_bootstrap_owner);
      // reduce to exactly one owner, then try to remove it every way
      const [keep, ...rest] = all;
      for (const o of rest) await m.userService.setOwner(o.id, false, 'actor');
      assert.equal((await m.userService.list()).filter((u) => u.is_owner).length, 1);
      for (const fn of [
        () => m.userService.setOwner(keep.id, false, 'someone-else'),
        () => m.userService.setActive(keep.id, false, 'someone-else'),
        () => m.userService.remove(keep.id, 'someone-else'),
      ]) await assert.rejects(fn, (e) => e.statusCode === 409 && e.code === 'LAST_OWNER');
      assert.equal((await rowOf(keep.id)).is_owner, 1);
      // after promoting a second owner the first can step down
      const second = await mk('second@example.com', [], 'actor');
      await m.userService.setOwner(second.id, true, 'actor');
      await m.userService.setOwner(keep.id, false, 'actor');
      assert.equal((await m.userService.list()).filter((u) => u.is_owner).length, 1);
    } finally {
      process.env.OWNER_FIREBASE_UID = saved;
    }
  });

  it('concurrent demotion of the final two owners leaves exactly one owner', async () => {
    const saved = process.env.OWNER_FIREBASE_UID;
    delete process.env.OWNER_FIREBASE_UID;
    try {
      const current = (await m.userService.list()).filter((u) => u.is_owner);
      for (const o of current.slice(1)) await m.userService.setOwner(o.id, false, 'a');
      const a = await mk('race-a@example.com', [], 'a');
      const b = current[0];
      await m.userService.setOwner(a.id, true, 'a');
      const results = await Promise.allSettled([m.userService.setOwner(a.id, false, 'a'), m.userService.setOwner(b.id, false, 'a')]);
      const ownersLeft = (await m.userService.list()).filter((u) => u.is_owner).length;
      assert.equal(ownersLeft, 1);
      assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    } finally {
      process.env.OWNER_FIREBASE_UID = saved;
    }
  });

  it('an owner cannot disable or delete their own account (accidental lock-out)', async () => {
    const u = await mk('selfowner@example.com');
    await m.userService.setOwner(u.id, true, BOOT_UID);
    const uid = await uidOf(u.id);
    await assert.rejects(m.userService.setActive(u.id, false, uid), (e) => e.statusCode === 400);
    await assert.rejects(m.userService.remove(u.id, uid), (e) => e.statusCode === 400);
  });

  it('promoting a disabled account to owner is rejected', async () => {
    const u = await mk('disabled-target@example.com');
    await m.userService.setActive(u.id, false, BOOT_UID);
    await assert.rejects(m.userService.setOwner(u.id, true, BOOT_UID), (e) => e.statusCode === 409);
  });

  it('input validation: is_owner must be a boolean; unknown id is 404', async () => {
    await assert.rejects(m.userService.setOwner(1, 'yes', BOOT_UID), (e) => e.statusCode === 400);
    await assert.rejects(m.userService.setOwner(999999, true, BOOT_UID), (e) => e.statusCode === 404);
  });

  it('every user-management route sits behind requireOwner and the owner route exists (static wiring check)', () => {
    const src = fs.readFileSync(new URL('../src/routes/adminUserRoutes.js', import.meta.url), 'utf8');
    assert.match(src, /router\.use\(authMiddleware, adminMiddleware, requireOwner\)/);
    for (const r of ["router.get('/'", "router.post('/'", "router.put('/:id/permissions'", "router.put('/:id/owner'", "router.patch('/:id'", "router.delete('/:id'"]) {
      assert.ok(src.includes(r), r);
    }
  });
});
