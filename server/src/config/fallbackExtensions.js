/**
 * Local-dev JSON fallback support for the SQL added by migration 004 (permissions + scheduled
 * publishing). It is only used when MySQL is not configured (never in production). Each handler
 * mirrors ONE exact statement issued by userService / blogService / scheduleService / adminMiddleware.
 * Returns undefined for any statement it does not own, so db.js falls through to the existing emulator.
 */
const norm = (sql) => sql.replace(/\s+/g, ' ').trim();
const nowStr = () => new Date().toISOString().replace('T', ' ').substring(0, 19);
const dup = (key) => {
  const e = new Error(`Duplicate entry for key '${key}'`);
  e.code = 'ER_DUP_ENTRY';
  return e;
};

/** Adds the migration-004 columns/tables to a fallback data object. Returns true if it changed. */
export const migrateExtendedFallback = (data) => {
  let changed = false;
  for (const a of data.admins || []) {
    if (a.is_delegated === undefined) { a.is_delegated = 0; changed = true; }
    if (a.is_active === undefined) { a.is_active = 1; changed = true; }
    if (a.is_owner === undefined) { a.is_owner = 0; changed = true; }
    if (a.created_by === undefined) { a.created_by = null; changed = true; }
  }
  if (!Array.isArray(data.admin_permissions)) { data.admin_permissions = []; changed = true; }
  for (const b of data.blogs || []) {
    if (b.scheduled_at === undefined) { b.scheduled_at = null; changed = true; }
  }
  return changed;
};

export const handleExtendedFallbackQuery = (rawSql, params, data, save) => {
  const sql = norm(rawSql);
  if (!Array.isArray(data.admin_permissions)) data.admin_permissions = [];

  // ---- admins / admin_permissions -------------------------------------------------------------
  if (sql === 'SELECT * FROM admins ORDER BY id ASC') {
    return [[...data.admins].sort((a, b) => Number(a.id) - Number(b.id))];
  }
  let m = /^SELECT (admin_id, permission|permission) FROM admin_permissions( WHERE admin_id = \?)?$/.exec(sql);
  if (m) {
    let rows = data.admin_permissions;
    if (m[2]) rows = rows.filter((r) => Number(r.admin_id) === Number(params[0]));
    return [rows.map((r) => (m[1] === 'permission' ? { permission: r.permission } : { admin_id: r.admin_id, permission: r.permission }))];
  }
  if (sql === 'INSERT INTO admins (firebase_uid, email, name, is_delegated, is_active, created_by) VALUES (?, ?, ?, 1, 1, ?)') {
    const [firebase_uid, email, name, created_by] = params;
    if (data.admins.some((a) => a.firebase_uid === firebase_uid)) throw dup('firebase_uid');
    const row = {
      id: data.nextAdminId++,
      firebase_uid,
      email,
      name: name || 'Admin User',
      is_delegated: 1,
      is_active: 1,
      is_owner: 0,
      created_by: created_by ?? null,
      created_at: new Date().toISOString(),
    };
    data.admins.push(row);
    save(data);
    return [{ insertId: row.id, affectedRows: 1 }];
  }
  if (sql === 'UPDATE admins SET is_delegated = 1 WHERE id = ?') {
    const a = data.admins.find((x) => Number(x.id) === Number(params[0]));
    if (a) { a.is_delegated = 1; save(data); }
    return [{ affectedRows: a ? 1 : 0 }];
  }
  if (sql === 'SELECT id FROM admins WHERE is_owner = 1 AND is_active = 1 FOR UPDATE') {
    return [data.admins.filter((a) => Number(a.is_owner) === 1 && Number(a.is_active) === 1).map((a) => ({ id: a.id }))];
  }
  if (sql === 'UPDATE admins SET is_owner = 1 WHERE id = ?' || sql === 'UPDATE admins SET is_owner = 0 WHERE id = ?') {
    const a = data.admins.find((x) => Number(x.id) === Number(params[0]));
    if (a) { a.is_owner = sql.endsWith('= 1 WHERE id = ?') ? 1 : 0; save(data); }
    return [{ affectedRows: a ? 1 : 0 }];
  }
  if (sql === 'UPDATE admins SET is_active = ? WHERE id = ?') {
    const a = data.admins.find((x) => Number(x.id) === Number(params[1]));
    if (a) { a.is_active = Number(params[0]) ? 1 : 0; save(data); }
    return [{ affectedRows: a ? 1 : 0 }];
  }
  if (sql === 'DELETE FROM admin_permissions WHERE admin_id = ?') {
    const before = data.admin_permissions.length;
    data.admin_permissions = data.admin_permissions.filter((r) => Number(r.admin_id) !== Number(params[0]));
    save(data);
    return [{ affectedRows: before - data.admin_permissions.length }];
  }
  if (sql === 'INSERT INTO admin_permissions (admin_id, permission, granted_by) VALUES (?, ?, ?)') {
    const [admin_id, permission, granted_by] = params;
    if (!data.admins.some((a) => Number(a.id) === Number(admin_id))) throw new Error('FK violation: admin does not exist');
    if (data.admin_permissions.some((r) => Number(r.admin_id) === Number(admin_id) && r.permission === permission)) throw dup('PRIMARY');
    data.admin_permissions.push({ admin_id: Number(admin_id), permission, granted_by: granted_by ?? null, granted_at: nowStr() });
    save(data);
    return [{ affectedRows: 1 }];
  }
  if (sql === 'DELETE FROM admins WHERE id = ?') {
    const id = Number(params[0]);
    const before = data.admins.length;
    data.admins = data.admins.filter((a) => Number(a.id) !== id);
    data.admin_permissions = data.admin_permissions.filter((r) => Number(r.admin_id) !== id); // ON DELETE CASCADE
    save(data);
    return [{ affectedRows: before - data.admins.length }];
  }

  // ---- blogs: scheduled publishing ------------------------------------------------------------
  if (sql === 'INSERT INTO blogs (blog_id, title, content, tags, conclusion, status, image_url, image_public_id, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)') {
    const [blog_id, title, content, tags, conclusion, status, image_url, image_public_id, scheduled_at] = params;
    if (data.blogs.some((b) => b.blog_id === blog_id)) throw dup('uq_blogs_blog_id');
    const now = nowStr();
    const blog = {
      id: data.nextBlogId++, blog_id, title, content, tags, conclusion, status,
      image_url: image_url ?? null, image_public_id: image_public_id ?? null,
      scheduled_at: scheduled_at ?? null, views: 0, created_at: now, updated_at: now,
    };
    data.blogs.unshift(blog);
    save(data);
    return [{ insertId: blog.id, affectedRows: 1 }];
  }
  if (sql === "UPDATE blogs SET title = ?, content = ?, tags = ?, conclusion = ?, status = 'Scheduled', image_url = ?, image_public_id = ?, scheduled_at = ? WHERE id = ? AND status IN ('Draft', 'Scheduled')") {
    const [title, content, tags, conclusion, image_url, image_public_id, scheduled_at, id] = params;
    const b = data.blogs.find((x) => Number(x.id) === Number(id) && ['Draft', 'Scheduled'].includes(x.status));
    if (!b) return [{ affectedRows: 0 }];
    Object.assign(b, { title, content, tags, conclusion, status: 'Scheduled', image_url: image_url ?? null, image_public_id: image_public_id ?? null, scheduled_at, updated_at: nowStr() });
    save(data);
    return [{ affectedRows: 1 }];
  }
  if (sql === "UPDATE blogs SET status = 'Scheduled', scheduled_at = ? WHERE id = ? AND status IN ('Draft', 'Scheduled')") {
    const b = data.blogs.find((x) => Number(x.id) === Number(params[1]) && ['Draft', 'Scheduled'].includes(x.status));
    if (!b) return [{ affectedRows: 0 }];
    Object.assign(b, { status: 'Scheduled', scheduled_at: params[0], updated_at: nowStr() });
    save(data);
    return [{ affectedRows: 1 }];
  }
  if (sql === "UPDATE blogs SET status = 'Draft', scheduled_at = NULL WHERE id = ? AND status = 'Scheduled'") {
    const b = data.blogs.find((x) => Number(x.id) === Number(params[0]) && x.status === 'Scheduled');
    if (!b) return [{ affectedRows: 0 }];
    Object.assign(b, { status: 'Draft', scheduled_at: null, updated_at: nowStr() });
    save(data);
    return [{ affectedRows: 1 }];
  }
  if (sql === 'UPDATE blogs SET scheduled_at = NULL WHERE id = ?') {
    const b = data.blogs.find((x) => Number(x.id) === Number(params[0]));
    if (b) { b.scheduled_at = null; save(data); }
    return [{ affectedRows: b ? 1 : 0 }];
  }
  if (sql === "SELECT id, blog_id, title, scheduled_at FROM blogs WHERE status = 'Scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC, id ASC LIMIT ?") {
    const [now, limit] = params;
    const rows = data.blogs
      .filter((b) => b.status === 'Scheduled' && b.scheduled_at && b.scheduled_at <= now)
      .sort((a, b) => (a.scheduled_at < b.scheduled_at ? -1 : a.scheduled_at > b.scheduled_at ? 1 : Number(a.id) - Number(b.id)))
      .slice(0, Number(limit))
      .map((b) => ({ id: b.id, blog_id: b.blog_id, title: b.title, scheduled_at: b.scheduled_at }));
    return [rows];
  }
  if (sql === "SELECT COUNT(*) AS pending FROM blogs WHERE status = 'Scheduled' AND scheduled_at > ?") {
    return [[{ pending: data.blogs.filter((b) => b.status === 'Scheduled' && b.scheduled_at && b.scheduled_at > params[0]).length }]];
  }
  if (sql === "SELECT COUNT(*) AS scheduled FROM blogs WHERE status = 'Scheduled'") {
    return [[{ scheduled: data.blogs.filter((b) => b.status === 'Scheduled').length }]];
  }
  if (sql === "UPDATE blogs SET status = 'Published' WHERE id = ? AND status = 'Scheduled' AND scheduled_at <= ?") {
    const [id, now] = params;
    const b = data.blogs.find((x) => Number(x.id) === Number(id) && x.status === 'Scheduled' && x.scheduled_at && x.scheduled_at <= now);
    if (!b) return [{ affectedRows: 0 }];
    Object.assign(b, { status: 'Published', updated_at: nowStr() }); // created_at is never touched
    save(data);
    return [{ affectedRows: 1 }];
  }
  return undefined;
};
