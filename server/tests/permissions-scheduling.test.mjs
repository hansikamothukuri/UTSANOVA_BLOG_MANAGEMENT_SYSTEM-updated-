/**
 * Focused tests: permission-based access control, scheduled publishing, cron authentication and
 * public visibility. They run against the LOCAL JSON FALLBACK store inside a temporary directory
 * (no MySQL, no Firebase, no Cloudinary, no network) and never touch your real data.
 *
 * Run from the project root (Node 20+):
 *   node --import ./server/tests/helpers/register-stubs.mjs --test server/tests/permissions-scheduling.test.mjs
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const originalCwd = process.cwd();
const here = path.dirname(fileURLToPath(import.meta.url));
const srcUrl = (p) => new URL(`../src/${p}`, import.meta.url).href;

const OWNER_UID = 'owner-uid-0001';
const CRON_SECRET = 'x'.repeat(40);
let tmpDir;
let m = {}; // loaded modules

// ---- tiny req/res doubles ---------------------------------------------------------------------
const mkRes = () => {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  return res;
};
// Runs an Express-style middleware chain; resolves with { res, reachedHandler }
const run = async (chain, req) => {
  const res = mkRes();
  let reached = false;
  const steps = [...chain, (_req, _res, next) => { reached = true; next?.(); }];
  for (const step of steps) {
    let called = false;
    await step(req, res, () => { called = true; });
    if (!called) return { res, reached };
  }
  return { res, reached };
};
const user = (uid, extra = {}) => ({ user: { uid, email: `${uid}@example.com`, email_verified: true, ...extra } });
const asAdmin = (req) => [m.adminMiddleware, ...req];

const fakeAuth = () => {
  const created = new Map();
  return {
    created,
    async getUserByEmail(email) { return [...created.values()].find((u) => u.email === email) || (email === 'taken@example.com' ? { uid: 'x' } : null); },
    async createUser({ email, displayName }) { const u = { uid: `fb-${created.size + 1}`, email, displayName }; created.set(u.uid, u); return u; },
    async setDisabled() {},
    async deleteUser(uid) { created.delete(uid); },
    async generatePasswordResetLink() { return 'https://example.invalid/reset?oobCode=TEST'; },
  };
};

const blogInput = (over = {}) => ({ title: 'Test blog', content: 'Body text', tags: 'Tech, News', conclusion: 'Done', status: 'Draft', ...over });
const IST = (s) => s; // readability: values without a zone are Asia/Kolkata

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'utsanova-perm-test-'));
  process.chdir(tmpDir); // the fallback store is <cwd>/utsanova_blog_data.json
  for (const k of Object.keys(process.env)) if (k.startsWith('DATABASE_')) delete process.env[k];
  delete process.env.VERCEL;
  process.env.NODE_ENV = 'test';
  process.env.OWNER_FIREBASE_UID = OWNER_UID;
  delete process.env.OWNER_EMAIL;
  process.env.CRON_SECRET = CRON_SECRET;

  m.db = (await import(srcUrl('config/db.js'))).default;
  m.adminMiddleware = (await import(srcUrl('middleware/adminMiddleware.js'))).adminMiddleware;
  const pm = await import(srcUrl('middleware/permissionMiddleware.js'));
  Object.assign(m, pm);
  m.perm = await import(srcUrl('utils/permissions.js'));
  m.sched = await import(srcUrl('utils/schedule.js'));
  m.userService = (await import(srcUrl('services/userService.js'))).default;
  m.adminService = (await import(srcUrl('services/adminService.js'))).default;
  m.blogService = (await import(srcUrl('services/blogService.js'))).default;
  m.scheduleService = (await import(srcUrl('services/scheduleService.js'))).default;
  m.blogController = (await import(srcUrl('controllers/blogController.js'))).default;
  m.cron = await import(srcUrl('routes/cronRoutes.js'));
  m.fb = fakeAuth();
  m.userService.setAuthProvider(m.fb);
  await m.db.initDB();
});

after(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ================================================================================================
describe('permission model (pure)', () => {
  it('bootstrap owner is identified by the configured UID only (comma separated list supported)', () => {
    assert.equal(m.perm.isOwnerIdentity({ uid: OWNER_UID }), true);
    assert.equal(m.perm.isOwnerIdentity({ uid: 'someone', email: 'owner@x.com', email_verified: true }), false);
    assert.equal(m.perm.isOwnerIdentity({ uid: 'b' }, { OWNER_FIREBASE_UID: 'a, b ,c' }), true);
  });

  it('an email address (even verified, even OWNER_EMAIL) never grants ownership', () => {
    const env = { OWNER_EMAIL: 'owner@example.com' };
    assert.equal(m.perm.isOwnerIdentity({ uid: 'u', email: 'owner@example.com', email_verified: true }, env), false);
  });

  it('delegated gets exactly its codes; legacy admin keeps all blog codes; disabled gets none', () => {
    const user = { uid: 'u1' };
    const del = m.perm.resolveAccess({ user, adminRow: { is_delegated: 1, is_active: 1 }, permissionRows: [{ permission: 'BLOG_READ' }, { permission: 'BOGUS' }] });
    assert.deepEqual(del.permissions, ['BLOG_READ']);
    assert.equal(del.isOwner, false);
    const dbOwner = m.perm.resolveAccess({ user, adminRow: { is_owner: 1, is_delegated: 1, is_active: 1 } });
    assert.equal(dbOwner.isOwner, true);
    assert.deepEqual(dbOwner.permissions, m.perm.ALL_PERMISSIONS);
    assert.equal(m.perm.resolveAccess({ user, adminRow: { is_owner: 1, is_active: 0 } }).isOwner, false); // disabled owner is not an owner
    const legacy = m.perm.resolveAccess({ user, adminRow: { is_delegated: 0, is_active: 1 } });
    assert.deepEqual(legacy.permissions, m.perm.ALL_PERMISSIONS);
    assert.equal(legacy.isOwner, false);
    assert.equal(m.perm.resolveAccess({ user, adminRow: { is_delegated: 1, is_active: 0 } }).disabled, true);
    assert.equal(m.perm.resolveAccess({ user, adminRow: null }), null);
  });

  it('rejects unknown, duplicate-safe and non-array permission input', () => {
    assert.ok(m.perm.validatePermissionList('BLOG_READ').error);
    assert.ok(m.perm.validatePermissionList(['BLOG_READ', 'ADMIN']).error);
    assert.deepEqual(m.perm.validatePermissionList(['BLOG_UPDATE', 'BLOG_READ', 'BLOG_READ']).value, ['BLOG_READ', 'BLOG_UPDATE']);
  });
});

// ================================================================================================
describe('backend permission enforcement (middleware chain, DB-backed)', () => {
  let readerId, editorId, deleterId;

  it('owner (UID from server config) passes every check even with NO admins row', async () => {
    const req = user(OWNER_UID);
    for (const code of m.perm.ALL_PERMISSIONS) {
      const { res, reached } = await run(asAdmin([m.requirePermission(code)]), { ...req });
      assert.equal(reached, true, `${code}: ${res.statusCode}`);
    }
    assert.equal((await run(asAdmin([m.requireOwner]), { ...req })).reached, true);
  });

  it('owner provisions delegated users (Firebase account created, link returned, row saved)', async () => {
    const r = await m.userService.create({ email: 'Editor1@Example.com', name: 'Reader', permissions: ['BLOG_READ'], actorUid: OWNER_UID });
    assert.equal(r.user.email, 'editor1@example.com');
    assert.deepEqual(r.user.permissions, ['BLOG_READ']);
    assert.equal(r.user.kind, 'delegated');
    assert.ok(r.password_setup_link);
    assert.equal('firebase_uid' in r.user, false);
    readerId = r.user.id;
    editorId = (await m.userService.create({ email: 'editor2@example.com', permissions: ['BLOG_READ', 'BLOG_CREATE', 'BLOG_UPDATE'], actorUid: OWNER_UID })).user.id;
    deleterId = (await m.userService.create({ email: 'deleter@example.com', permissions: ['BLOG_READ', 'BLOG_DELETE'], actorUid: OWNER_UID })).user.id;
  });

  const uidOf = async (id) => (await m.db.query('SELECT * FROM admins WHERE id = ?', [id]))[0][0].firebase_uid;

  it('read-only user: READ allowed; CREATE / UPDATE / DELETE rejected with 403 before any handler', async () => {
    const req = user(await uidOf(readerId));
    assert.equal((await run(asAdmin([m.requirePermission('BLOG_READ')]), { ...req })).reached, true);
    for (const code of ['BLOG_CREATE', 'BLOG_UPDATE', 'BLOG_DELETE']) {
      const { res, reached } = await run(asAdmin([m.requirePermission(code)]), { ...req });
      assert.equal(reached, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.code, 'PERMISSION_DENIED');
    }
  });

  it('editor (READ+CREATE+UPDATE): cannot DELETE and cannot use user management', async () => {
    const req = user(await uidOf(editorId));
    for (const code of ['BLOG_READ', 'BLOG_CREATE', 'BLOG_UPDATE']) {
      assert.equal((await run(asAdmin([m.requirePermission(code)]), { ...req })).reached, true, code);
    }
    assert.equal((await run(asAdmin([m.requirePermission('BLOG_DELETE')]), { ...req })).res.statusCode, 403);
    const owner = await run(asAdmin([m.requireOwner]), { ...req });
    assert.equal(owner.reached, false);
    assert.equal(owner.res.statusCode, 403);
  });

  it('revocation: removing BLOG_DELETE is saved and the very next delete request is rejected', async () => {
    const req = user(await uidOf(deleterId));
    assert.equal((await run(asAdmin([m.requirePermission('BLOG_DELETE')]), { ...req })).reached, true);
    const updated = await m.userService.setPermissions(deleterId, ['BLOG_READ'], OWNER_UID);
    assert.deepEqual(updated.permissions, ['BLOG_READ']);
    const after = await run(asAdmin([m.requirePermission('BLOG_DELETE')]), { ...req });
    assert.equal(after.reached, false);
    assert.equal(after.res.statusCode, 403);
    const saved = (await m.db.query('SELECT permission FROM admin_permissions WHERE admin_id = ?', [deleterId]))[0];
    assert.deepEqual(saved.map((r) => r.permission), ['BLOG_READ']);
  });

  it('a delegated user cannot grant themselves anything (user management is owner-only)', async () => {
    const { reached, res } = await run(asAdmin([m.requireOwner]), user(await uidOf(deleterId)));
    assert.equal(reached, false);
    assert.equal(res.body.code, 'OWNER_ONLY');
  });

  it('disabled account is rejected by the backend immediately', async () => {
    await m.userService.setActive(readerId, false);
    const { res, reached } = await run(asAdmin([m.requirePermission('BLOG_READ')]), user(await uidOf(readerId)));
    assert.equal(reached, false);
    assert.equal(res.statusCode, 403);
    await m.userService.setActive(readerId, true);
    assert.equal((await run(asAdmin([m.requirePermission('BLOG_READ')]), user(await uidOf(readerId)))).reached, true);
  });

  it('unknown / unverified accounts get no admin access', async () => {
    assert.equal((await run(asAdmin([]), user('stranger-uid'))).res.statusCode, 403);
  });

  it('every admin blog route declares its permission (static wiring check)', () => {
    const src = fs.readFileSync(path.resolve(here, '../src/routes/adminBlogRoutes.js'), 'utf8');
    const expect = { post: ['/', 'BLOG_CREATE'], get: ['/', 'BLOG_READ'], put: ['/:id', 'BLOG_UPDATE'], delete: ['/:id', 'BLOG_DELETE'] };
    for (const [verb, [route, code]] of Object.entries(expect)) {
      const line = src.split('\n').find((l) => l.startsWith(`router.${verb}('${route}'`));
      assert.ok(line && line.includes(`PERMISSIONS.${code}`), `${verb.toUpperCase()} ${route} must require ${code}`);
    }
    assert.match(src, /router\.get\('\/:id', requirePermission\(PERMISSIONS\.BLOG_READ\)/);
    assert.match(src, /router\.post\('\/:id\/schedule', requirePermission\(PERMISSIONS\.BLOG_UPDATE\)/);
    assert.match(src, /router\.post\('\/:id\/cancel-schedule', requirePermission\(PERMISSIONS\.BLOG_UPDATE\)/);
    const users = fs.readFileSync(path.resolve(here, '../src/routes/adminUserRoutes.js'), 'utf8');
    assert.match(users, /router\.use\(authMiddleware, adminMiddleware, requireOwner\)/);
  });
});

// ================================================================================================
describe('account provisioning safety (no auto-grant, no linking, no duplicates)', () => {
  it('rejects duplicate emails (DB and Firebase) with 409 and creates nothing extra', async () => {
    await assert.rejects(m.userService.create({ email: 'editor1@example.com', permissions: [] }), (e) => e.statusCode === 409);
    await assert.rejects(m.userService.create({ email: 'taken@example.com', permissions: [] }), (e) => e.statusCode === 409);
  });

  it('rejects invalid email / unknown permission codes with 400', async () => {
    await assert.rejects(m.userService.create({ email: 'nope', permissions: [] }), (e) => e.statusCode === 400);
    await assert.rejects(m.userService.create({ email: 'ok@example.com', permissions: ['BLOG_ADMIN'] }), (e) => e.statusCode === 400);
  });

  it('a bootstrap-owner row cannot be modified, disabled or deleted through user management', async () => {
    const [res] = await m.db.query('INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)', [OWNER_UID, 'owner@example.com', 'Owner', null]);
    const id = res.insertId;
    await assert.rejects(m.userService.setPermissions(id, [], 'x'), (e) => e.statusCode === 403);
    await assert.rejects(m.userService.setActive(id, false), (e) => e.statusCode === 403);
    await assert.rejects(m.userService.remove(id), (e) => e.statusCode === 403);
    // ...and a mis-flagged owner row never reduces the owner's own access
    assert.equal((await run(asAdmin([m.requirePermission('BLOG_DELETE')]), user(OWNER_UID))).reached, true);
  });

  it('unauthorized account: an UNVERIFIED email matching an existing admin record is not linked or promoted', async () => {
    await m.db.query('INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)', ['placeholder-1', 'target@example.com', 'Target', null]);
    // legacy (non-delegated) row with a placeholder UID, as in older seeds
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, 'utsanova_blog_data.json'), 'utf8'));
    data.admins.push({ id: 900, firebase_uid: 'legacy-placeholder', email: 'legacy@example.com', name: 'Legacy', is_delegated: 0, is_active: 1, created_by: null });
    fs.writeFileSync(path.join(tmpDir, 'utsanova_blog_data.json'), JSON.stringify(data));

    const attacker = { uid: 'attacker-uid', email: 'legacy@example.com', email_verified: false };
    assert.equal((await run(asAdmin([]), { user: attacker })).res.statusCode, 403);
    await assert.rejects(m.adminService.registerFromToken({ firebase_uid: 'attacker-uid', email: 'legacy@example.com', name: 'x', emailVerified: false }), (e) => e.statusCode === 409);
    // delegated rows are never linked, even with a verified email
    await assert.rejects(m.adminService.registerFromToken({ firebase_uid: 'attacker-2', email: 'target@example.com', name: 'x', emailVerified: true }), (e) => e.statusCode === 409);
    const rows = (await m.db.query('SELECT * FROM admins WHERE email = ?', ['legacy@example.com']))[0];
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firebase_uid, 'legacy-placeholder');
  });

  it('verified owner-of-email legacy admin can still be linked (existing flow preserved, no duplicate row)', async () => {
    const verified = { uid: 'real-legacy-uid', email: 'legacy@example.com', email_verified: true };
    const r = await run(asAdmin([m.requirePermission('BLOG_DELETE')]), { user: verified });
    assert.equal(r.reached, true);
    assert.equal((await m.db.query('SELECT * FROM admins WHERE email = ?', ['legacy@example.com']))[0].length, 1);
    assert.equal((await run(asAdmin([m.requireOwner]), { user: verified })).reached, false); // legacy never manages users
  });

  it('brand-new self-registered account gets ZERO permissions (never auto-granted)', async () => {
    const { admin, created } = await m.adminService.registerFromToken({ firebase_uid: 'new-uid', email: 'new@example.com', name: 'New', emailVerified: true });
    assert.equal(created, true);
    const req = user('new-uid');
    assert.equal((await run(asAdmin([]), { ...req })).reached, true); // known account...
    for (const code of m.perm.ALL_PERMISSIONS) {
      assert.equal((await run(asAdmin([m.requirePermission(code)]), { ...req })).res.statusCode, 403, code); // ...with no powers
    }
    assert.equal(Number(admin.is_delegated), 1);
  });
});

// ================================================================================================
describe('schedule time parsing', () => {
  const now = new Date('2026-10-11T00:00:00Z');
  it('treats zone-less input as Asia/Kolkata and stores UTC (10:00 IST = 04:30 UTC)', () => {
    const r = m.sched.parseScheduledAt(IST('2026-10-15T10:00'), { now });
    assert.equal(r.value.toISOString(), '2026-10-15T04:30:00.000Z');
    assert.equal(m.sched.toMysqlUtc(r.value), '2026-10-15 04:30:00');
  });
  it('honours explicit offsets and Z', () => {
    assert.equal(m.sched.parseScheduledAt('2026-10-15T10:00:00+05:30', { now }).value.toISOString(), '2026-10-15T04:30:00.000Z');
    assert.equal(m.sched.parseScheduledAt('2026-10-15T04:30:00Z', { now }).value.toISOString(), '2026-10-15T04:30:00.000Z');
  });
  it('rejects past, malformed and impossible dates', () => {
    for (const bad of ['2026-10-10T10:00', 'tomorrow', '', null, '2026-02-30T10:00', '2026-13-01T10:00', '2026-10-15T25:00']) {
      assert.ok(m.sched.parseScheduledAt(bad, { now }).error, String(bad));
    }
  });
  it('toUtcIso round-trips DB values regardless of server time zone', () => {
    assert.equal(m.sched.toUtcIso('2026-10-15 04:30:00'), '2026-10-15T04:30:00.000Z');
    assert.equal(m.sched.toUtcIso(new Date(2026, 9, 15, 4, 30, 0)), '2026-10-15T04:30:00.000Z'); // mysql2 'local' Date
    assert.equal(m.sched.toUtcIso(null), null);
  });
});

// ================================================================================================
describe('scheduled publishing + public visibility', () => {
  const future = IST('2099-10-15T10:00'); // 2099-10-15 04:30 UTC
  const dueAt = new Date('2099-10-15T04:35:00Z'); // 10:05 IST
  const early = new Date('2099-10-15T04:00:00Z'); // 09:30 IST
  const publicIds = async (q = {}) => (await m.blogService.getPublishedBlogs({ page: 1, limit: 50, ...q })).blogs.map((b) => b.blog_id);
  let blog, original;

  it('schedules a blog; it is saved with its UTC time and hidden everywhere public', async () => {
    const sa = m.sched.parseScheduledAt(future).value;
    blog = await m.blogService.createBlog({ ...blogInput({ title: 'The Future of Artificial Intelligence', tags: 'AI, Futurism', status: 'Scheduled' }), scheduledAt: sa });
    original = blog.created_at;
    assert.equal(blog.status, 'Scheduled');
    assert.equal(blog.scheduled_at, '2099-10-15T04:30:00.000Z');

    assert.equal((await publicIds()).includes(blog.blog_id), false);
    assert.equal((await publicIds({ search: 'Artificial Intelligence' })).includes(blog.blog_id), false);
    assert.equal((await publicIds({ tag: 'Futurism' })).includes(blog.blog_id), false);
    assert.equal(await m.blogService.getPublishedBlogById(blog.blog_id), null);
    assert.equal(await m.blogService.getRelatedBlogs(blog.blog_id), null);
    assert.equal(await m.blogService.incrementViews(blog.blog_id), null);
    // a published sibling sharing the tag must not list the scheduled blog as related
    const sib = await m.blogService.createBlog(blogInput({ title: 'Sibling', tags: 'AI, Futurism', status: 'Published' }));
    assert.equal((await m.blogService.getRelatedBlogs(sib.blog_id)).some((b) => b.blog_id === blog.blog_id), false);
    // admin still sees it
    assert.equal((await m.blogService.getAdminBlogs({ status: 'Scheduled' })).blogs.some((b) => b.blog_id === blog.blog_id), true);
  });

  it('not yet due (09:30 IST): nothing is published and the blog stays Scheduled + hidden', async () => {
    const r = await m.scheduleService.publishDue({ now: early });
    assert.equal(r.published_count, 0);
    assert.equal((await m.blogService.getBlogById(blog.blog_id)).status, 'Scheduled');
    assert.equal((await publicIds()).includes(blog.blog_id), false);
  });

  it('dry run (10:05 IST) reports the blog but changes nothing', async () => {
    const r = await m.scheduleService.publishDue({ now: dueAt, dryRun: true });
    assert.equal(r.dry_run, true);
    assert.deepEqual(r.would_publish.map((b) => b.blog_id), [blog.blog_id]);
    assert.equal(r.published_count, 0);
    assert.equal((await m.blogService.getBlogById(blog.blog_id)).status, 'Scheduled');
  });

  it('concurrent cron runs publish the due blog exactly once; created_at is preserved; it becomes public', async () => {
    const [a, b] = await Promise.all([m.scheduleService.publishDue({ now: dueAt }), m.scheduleService.publishDue({ now: dueAt })]);
    assert.equal(a.published_count + b.published_count, 1);
    const after = await m.blogService.getBlogById(blog.blog_id);
    assert.equal(after.status, 'Published');
    assert.equal(after.created_at, original);
    assert.equal((await publicIds()).includes(blog.blog_id), true);
    assert.equal((await publicIds({ search: 'Artificial Intelligence' })).includes(blog.blog_id), true);
    assert.equal((await m.scheduleService.publishDue({ now: dueAt })).published_count, 0); // idempotent
  });

  it('only eligible blogs are published (a later one and plain Draft/Published are left alone)', async () => {
    const draft = await m.blogService.createBlog(blogInput({ title: 'Plain draft', status: 'Draft' }));
    const later = await m.blogService.createBlog({ ...blogInput({ title: 'Later', status: 'Scheduled' }), scheduledAt: m.sched.parseScheduledAt('2099-12-01T10:00').value });
    const r = await m.scheduleService.publishDue({ now: dueAt });
    assert.equal(r.published_count, 0);
    assert.equal((await m.blogService.getBlogById(draft.blog_id)).status, 'Draft');
    assert.equal((await m.blogService.getBlogById(later.blog_id)).status, 'Scheduled');
  });

  it('reschedule: the new date is saved and the old one no longer publishes', async () => {
    const b = await m.blogService.createBlog({ ...blogInput({ title: 'Resched', status: 'Scheduled' }), scheduledAt: m.sched.parseScheduledAt('2099-10-15T10:00').value });
    const moved = await m.blogService.scheduleBlog(b.blog_id, m.sched.parseScheduledAt('2099-10-17T10:00').value);
    assert.equal(moved.scheduled_at, '2099-10-17T04:30:00.000Z');
    assert.equal((await m.scheduleService.publishDue({ now: dueAt })).published_count, 0); // 15 Oct: not published
    assert.equal((await m.scheduleService.publishDue({ now: new Date('2099-10-17T04:31:00Z') })).published_count, 1);
  });

  it('cancel: back to Draft, content preserved, never published by cron', async () => {
    const b = await m.blogService.createBlog({ ...blogInput({ title: 'Cancel me', content: 'Keep this text', status: 'Scheduled' }), scheduledAt: m.sched.parseScheduledAt('2099-10-15T10:00').value });
    const c = await m.blogService.cancelSchedule(b.blog_id);
    assert.equal(c.status, 'Draft');
    assert.equal(c.scheduled_at, null);
    assert.equal(c.content, 'Keep this text');
    assert.equal((await m.scheduleService.publishDue({ now: dueAt })).published_count, 0);
    await assert.rejects(m.blogService.cancelSchedule(b.blog_id), (e) => e.statusCode === 409); // not scheduled any more
  });

  it('already Published: scheduling returns 409 and the blog stays published', async () => {
    const pub = await m.blogService.createBlog(blogInput({ title: 'Live post', status: 'Published' }));
    await assert.rejects(m.blogService.scheduleBlog(pub.blog_id, m.sched.parseScheduledAt(future).value), (e) => e.statusCode === 409);

    const res = mkRes();
    await m.blogController.updateBlog({ params: { id: pub.blog_id }, body: { ...blogInput({ title: 'Live post', status: 'Scheduled' }), scheduled_at: future } }, res, (e) => { throw e; });
    assert.equal(res.statusCode, 409);
    // the schedule endpoint reports the conflict through next(err); errorHandler turns statusCode 409 into the response
    let forwarded;
    await m.blogController.scheduleBlog({ params: { id: pub.blog_id }, body: { scheduled_at: future } }, mkRes(), (e) => { forwarded = e; });
    assert.equal(forwarded?.statusCode, 409);
    const still = await m.blogService.getBlogById(pub.blog_id);
    assert.equal(still.status, 'Published');
    assert.equal((await publicIds()).includes(pub.blog_id), true);
  });

  it('API validation: Scheduled needs a valid future time (400); Draft/Published behave exactly as before', async () => {
    for (const body of [blogInput({ status: 'Scheduled' }), { ...blogInput({ status: 'Scheduled' }), scheduled_at: '2020-01-01T10:00' }]) {
      const res = mkRes();
      await m.blogController.createBlog({ body }, res, (e) => { throw e; });
      assert.equal(res.statusCode, 400);
    }
    for (const status of ['Draft', 'Published']) {
      const res = mkRes();
      await m.blogController.createBlog({ body: blogInput({ title: `Regression ${status}`, status }) }, res, (e) => { throw e; });
      assert.equal(res.statusCode, 201);
      assert.equal(res.body.data.status, status);
    }
    const bad = mkRes();
    await m.blogController.createBlog({ body: blogInput({ status: 'Archived' }) }, bad, (e) => { throw e; });
    assert.equal(bad.statusCode, 400);
  });

  it('editing a Scheduled blog and saving it as Draft cancels the schedule', async () => {
    const b = await m.blogService.createBlog({ ...blogInput({ title: 'Edit then draft', status: 'Scheduled' }), scheduledAt: m.sched.parseScheduledAt(future).value });
    const u = await m.blogService.updateBlog(b.blog_id, { status: 'Draft' });
    assert.equal(u.status, 'Draft');
    assert.equal(u.scheduled_at, null);
  });
});

// ================================================================================================
describe('cron endpoint authentication', () => {
  const call = async (headers, body = {}) => {
    const req = { headers, body, query: {} };
    const res = mkRes();
    let reached = false;
    await m.cron.cronAuth(req, res, () => { reached = true; });
    return { res, reached };
  };

  it('rejects missing, malformed and wrong secrets with 401 and never echoes the secret', async () => {
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { authorization: CRON_SECRET }, { authorization: `Basic ${CRON_SECRET}` }, { authorization: `Bearer ${CRON_SECRET}x` }]) {
      const { res, reached } = await call(headers);
      assert.equal(reached, false);
      assert.equal(res.statusCode, 401);
      assert.ok(!JSON.stringify(res.body).includes(CRON_SECRET));
    }
  });

  it('accepts the correct secret', async () => {
    assert.equal((await call({ authorization: `Bearer ${CRON_SECRET}` })).reached, true);
  });

  it('is disabled (503) when CRON_SECRET is unset or too short - never open', async () => {
    const saved = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'short';
    assert.equal((await call({ authorization: 'Bearer short' })).res.statusCode, 503);
    delete process.env.CRON_SECRET;
    assert.equal((await call({ authorization: 'Bearer ' })).res.statusCode, 503);
    process.env.CRON_SECRET = saved;
  });

  it('handler: unauthenticated call publishes nothing; invalid dry_run is rejected; dry_run is read-only', async () => {
    const sa = m.sched.parseScheduledAt('2099-01-01T10:00').value;
    const b = await m.blogService.createBlog({ ...blogInput({ title: 'Cron target', status: 'Scheduled' }), scheduledAt: sa });
    await call({}); // 401 path does not reach the handler
    assert.equal((await m.blogService.getBlogById(b.blog_id)).status, 'Scheduled');

    const bad = mkRes();
    await m.cron.publishScheduledBlogs({ body: { dry_run: 'maybe' }, query: {} }, bad, (e) => { throw e; });
    assert.equal(bad.statusCode, 400);

    const dry = mkRes();
    await m.cron.publishScheduledBlogs({ body: { dry_run: true }, query: {} }, dry, (e) => { throw e; });
    assert.equal(dry.statusCode, 200);
    assert.equal(dry.body.data.dry_run, true);
    assert.equal((await m.blogService.getBlogById(b.blog_id)).status, 'Scheduled');
  });
});
