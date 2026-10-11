import db from '../config/db.js';
import { httpError, withMigrationHint } from '../utils/httpError.js';
import { toMysqlUtc, toUtcIso } from '../utils/schedule.js';

/**
 * Maps a raw DB row to the API shape. The internal auto-increment `id` and the Cloudinary
 * `image_public_id` are deliberately NOT exposed; `blog_id` (4 digits) is the public identifier.
 */
export const toPublicBlog = (row) => {
  if (!row) return null;
  // eslint-disable-next-line no-unused-vars
  const { id, image_public_id, ...rest } = row;
  const out = { ...rest, blog_id: String(row.blog_id), image_url: row.image_url || null };
  // scheduled_at is stored as naive UTC; the API always returns ISO-8601 UTC (or null)
  if ('scheduled_at' in row) out.scheduled_at = toUtcIso(row.scheduled_at);
  return out;
};

// Allowed ?status= filters for admin lists
const BLOG_STATUS_FILTERS = ['Draft', 'Published', 'Scheduled'];

const toPublicBlogs = (rows) => (rows || []).map(toPublicBlog);

// Fixed ORDER BY clauses per allowed sort key. User input only ever SELECTS one of these keys;
// it is never concatenated into SQL. `id` is the deterministic tie-breaker (stable pagination).
const BLOG_SORT_SQL = {
  latest: 'created_at DESC, id DESC',
  oldest: 'created_at ASC, id ASC',
  popular: 'views DESC, created_at DESC, id DESC',
};

// MySQL error raised when migration 002 (blogs.views) has not been applied yet
const isMissingViewsColumn = (err) =>
  !!err && err.code === 'ER_BAD_FIELD_ERROR' && /views/i.test(err.sqlMessage || err.message || '');

const parseTagList = (tags) => [
  ...new Set(
    String(tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  ),
];

export const blogService = {
  /**
   * Retrieves published blogs with optional search and tag filters, paginated
   * using LIMIT/OFFSET at the database level plus a separate COUNT(*) query
   * for total-record metadata.
   */
  async getPublishedBlogs({ search, tag, page = 1, limit = 9, sort = 'latest' } = {}) {
    let sql = "SELECT * FROM blogs WHERE status = 'Published'";
    let countSql = "SELECT COUNT(*) AS total FROM blogs WHERE status = 'Published'";
    const params = [];

    if (tag && tag.trim()) {
      sql += ' AND tags LIKE ?';
      countSql += ' AND tags LIKE ?';
      params.push(`%${tag.trim()}%`);
    }

    if (search && search.trim()) {
      sql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
      countSql += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const [countRows] = await db.query(countSql, params);
    const totalBlogs = Number(countRows[0]?.total || 0);
    const totalPages = totalBlogs > 0 ? Math.ceil(totalBlogs / limit) : 0;
    const offset = (page - 1) * limit;

    const sortKey = Object.prototype.hasOwnProperty.call(BLOG_SORT_SQL, sort) ? sort : 'latest';
    const runList = (key) =>
      db.query(`${sql} ORDER BY ${BLOG_SORT_SQL[key]} LIMIT ? OFFSET ?`, [...params, limit, offset]);

    let appliedSort = sortKey;
    let rows;
    try {
      [rows] = await runList(sortKey);
    } catch (err) {
      // Popular needs blogs.views (migration 002). If it is missing, keep the site working with
      // the default order instead of failing the whole listing.
      if (sortKey === 'popular' && isMissingViewsColumn(err)) {
        console.warn('[blogs] blogs.views column missing - run migration 002. Falling back to latest.');
        appliedSort = 'latest';
        [rows] = await runList('latest');
      } else {
        throw err;
      }
    }

    return {
      blogs: toPublicBlogs(rows),
      pagination: {
        currentPage: page,
        limit,
        totalBlogs,
        totalPages,
      },
      sort: appliedSort,
    };
  },

  /**
   * Retrieves single published blog by its public 4-digit blog_id
   */
  async getPublishedBlogById(blogId) {
    const sql = "SELECT * FROM blogs WHERE blog_id = ? AND status = 'Published'";
    const [rows] = await db.query(sql, [blogId]);
    return rows.length > 0 ? toPublicBlog(rows[0]) : null;
  },

  /**
   * Related posts: other PUBLISHED blogs sharing at least one tag (exact, case-insensitive tag
   * match) with the given blog. Ordered by number of shared tags, then newest first, then id.
   * Returns null if the blog is not published / does not exist; [] if it has no tags or no matches.
   */
  async getRelatedBlogs(blogId, limit = 3) {
    const blog = await this.getRawPublishedByBlogId(blogId);
    if (!blog) return null;

    const tags = parseTagList(blog.tags).slice(0, 10);
    if (tags.length === 0) return [];

    // SQL pre-filters candidates (substring match, newest 100); exact tag matching and ranking
    // are done below so "Java" does not match "JavaScript".
    const likeClauses = tags.map(() => 'tags LIKE ?').join(' OR ');
    const [rows] = await db.query(
      `SELECT * FROM blogs WHERE status = 'Published' AND id <> ? AND (${likeClauses}) ORDER BY created_at DESC, id DESC LIMIT 100`,
      [blog.id, ...tags.map((t) => `%${t}%`)]
    );

    const mine = new Set(tags);
    const ranked = rows
      .map((row) => ({ row, shared: parseTagList(row.tags).filter((t) => mine.has(t)).length }))
      .filter((x) => x.shared > 0 && Number(x.row.id) !== Number(blog.id))
      .sort(
        (a, b) =>
          b.shared - a.shared ||
          new Date(b.row.created_at).getTime() - new Date(a.row.created_at).getTime() ||
          Number(b.row.id) - Number(a.row.id)
      )
      .slice(0, limit)
      .map((x) => x.row);

    return toPublicBlogs(ranked);
  },

  /**
   * Counts one view of a PUBLISHED blog (atomic `views = views + 1`, drafts are never counted).
   * Returns the new view count, or null when no published blog has this blog_id.
   */
  async incrementViews(blogId) {
    const [result] = await db.query(
      "UPDATE blogs SET views = views + 1 WHERE blog_id = ? AND status = 'Published'",
      [blogId]
    );
    if (!result?.affectedRows) return null;
    const row = await this.getRawByBlogId(blogId);
    return row ? Number(row.views) || 0 : null;
  },

  /** INTERNAL: raw row of a published blog (used to resolve the internal id for likes). */
  async getRawPublishedByBlogId(blogId) {
    const [rows] = await db.query(
      "SELECT * FROM blogs WHERE blog_id = ? AND status = 'Published'",
      [blogId]
    );
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Like state of a published blog: { like_count, liked }. `uid` is the verified Firebase UID
   * (or undefined for logged-out visitors => liked is false). Returns null if the blog is not
   * published / does not exist.
   */
  async getLikeState(blogId, uid) {
    const blog = await this.getRawPublishedByBlogId(blogId);
    if (!blog) return null;
    return this._likeState(blog.id, uid);
  },

  async _likeState(internalId, uid) {
    const [countRows] = await db.query(
      'SELECT COUNT(*) AS like_count FROM blog_likes WHERE blog_id = ?',
      [internalId]
    );
    let liked = false;
    if (uid) {
      const [likedRows] = await db.query(
        'SELECT id FROM blog_likes WHERE blog_id = ? AND firebase_uid = ? LIMIT 1',
        [internalId, uid]
      );
      liked = likedRows.length > 0;
    }
    return { like_count: Number(countRows[0]?.like_count || 0), liked };
  },

  /**
   * Idempotent like / unlike. The UNIQUE (blog_id, firebase_uid) key guarantees one like per
   * user per blog even under concurrent requests; repeating a call never errors or double counts.
   */
  async setLike(blogId, uid, shouldLike) {
    const blog = await this.getRawPublishedByBlogId(blogId);
    if (!blog) return null;
    if (shouldLike) {
      await db.query(
        'INSERT INTO blog_likes (blog_id, firebase_uid) VALUES (?, ?) ON DUPLICATE KEY UPDATE id = id',
        [blog.id, uid]
      );
    } else {
      await db.query('DELETE FROM blog_likes WHERE blog_id = ? AND firebase_uid = ?', [blog.id, uid]);
    }
    return this._likeState(blog.id, uid);
  },

  /**
   * Comments of a published blog, oldest first. Returns null if the blog is not published /
   * does not exist. Only the author's display name (from admins, via the verified Firebase UID)
   * is exposed - never the UID or email.
   */
  async getComments(blogId) {
    const blog = await this.getRawPublishedByBlogId(blogId);
    if (!blog) return null;
    const [rows] = await db.query(
      `SELECT c.id, c.content, c.created_at, a.name AS author_name
         FROM blog_comments c LEFT JOIN admins a ON a.firebase_uid = c.firebase_uid
        WHERE c.blog_id = ? ORDER BY c.created_at ASC, c.id ASC`,
      [blog.id]
    );
    return rows;
  },

  /**
   * Adds a comment to a published blog. `uid` is the verified Firebase UID (req.user.uid) and
   * `content` is already validated/trimmed. Returns the created comment, or null if the blog is
   * not published / does not exist.
   */
  async addComment(blogId, uid, content) {
    const blog = await this.getRawPublishedByBlogId(blogId);
    if (!blog) return null;
    const [result] = await db.query(
      'INSERT INTO blog_comments (blog_id, firebase_uid, content) VALUES (?, ?, ?)',
      [blog.id, uid, content]
    );
    const [rows] = await db.query(
      `SELECT c.id, c.content, c.created_at, a.name AS author_name
         FROM blog_comments c LEFT JOIN admins a ON a.firebase_uid = c.firebase_uid
        WHERE c.id = ?`,
      [result.insertId]
    );
    return rows[0] || null;
  },

  /**
   * Admin: Retrieves all blogs with optional status filter
   */
  async getAllBlogs({ status } = {}) {
    let sql = 'SELECT * FROM blogs';
    const params = [];

    if (status && BLOG_STATUS_FILTERS.includes(status)) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    return toPublicBlogs(rows);
  },

  /**
   * Admin: Retrieves blogs (drafts + published) with optional status filter and
   * search (title / content / tags), paginated at the database level using
   * LIMIT/OFFSET plus a separate COUNT(*) for the total.
   * An out-of-range page is clamped to the last valid page, so e.g. deleting the
   * last blog on the final page naturally returns the previous page.
   */
  async getAdminBlogs({ status, search, page = 1, limit = 9 } = {}) {
    let where = ' WHERE 1=1';
    const params = [];

    if (status && BLOG_STATUS_FILTERS.includes(status)) {
      where += ' AND status = ?';
      params.push(status);
    }

    if (search && search.trim()) {
      where += ' AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM blogs${where}`, params);
    const totalBlogs = Number(countRows[0]?.total || 0);
    const totalPages = totalBlogs > 0 ? Math.ceil(totalBlogs / limit) : 0;
    const currentPage = Math.min(Math.max(page, 1), Math.max(totalPages, 1));
    const offset = (currentPage - 1) * limit;

    const [rows] = await db.query(
      `SELECT * FROM blogs${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      blogs: toPublicBlogs(rows),
      pagination: {
        currentPage,
        limit,
        totalBlogs,
        totalPages,
      },
    };
  },

  /**
   * INTERNAL: raw row (includes internal id + image_public_id) by public blog_id.
   * Never send this object to a client - use toPublicBlog().
   */
  async getRawByBlogId(blogId) {
    const [rows] = await db.query('SELECT * FROM blogs WHERE blog_id = ?', [blogId]);
    return rows.length > 0 ? rows[0] : null;
  },

  /** INTERNAL: raw row by internal id (used right after INSERT). */
  async getRawByInternalId(internalId) {
    const [rows] = await db.query('SELECT * FROM blogs WHERE id = ?', [internalId]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Admin: Retrieves single blog by its public 4-digit blog_id
   */
  async getBlogById(blogId) {
    return toPublicBlog(await this.getRawByBlogId(blogId));
  },

  /**
   * Admin: Creates a new blog.
   * The 4-digit blog_id is generated HERE from an atomic counter; any blog_id sent by a client
   * is never read. `image` is { url, publicId } from Cloudinary, or omitted.
   */
  async createBlog({ title, content, tags, conclusion, status, image, scheduledAt }) {
    const blogId = await db.nextPublicBlogId();
    const scheduled = status === 'Scheduled';
    // Draft / Published keep the exact original INSERT; only Scheduled uses the scheduled_at column.
    const sql = scheduled
      ? 'INSERT INTO blogs (blog_id, title, content, tags, conclusion, status, image_url, image_public_id, scheduled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO blogs (blog_id, title, content, tags, conclusion, status, image_url, image_public_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [
      blogId,
      title.trim(),
      content.trim(),
      tags.trim(),
      conclusion.trim(),
      status,
      image?.url || null,
      image?.publicId || null,
    ];
    if (scheduled) {
      if (!scheduledAt) throw httpError(400, 'A scheduled publication time is required for Scheduled blogs');
      params.push(toMysqlUtc(scheduledAt));
    }

    const [result] = await withMigrationHint(() => db.query(sql, params));
    const insertId = result.insertId || result[0]?.insertId;

    if (insertId) {
      return toPublicBlog(await this.getRawByInternalId(insertId));
    }
    return null;
  },

  /**
   * Admin: Updates an existing blog. blog_id is never touched.
   * Image: pass `image` ({url, publicId}) to replace it, `removeImage: true` to clear it,
   * or neither to leave the current image exactly as it is.
   */
  async updateBlog(blogId, { title, content, tags, conclusion, status, image, removeImage, scheduledAt }) {
    const existing = await this.getRawByBlogId(blogId);
    if (!existing) {
      return null;
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedContent = content !== undefined ? content.trim() : existing.content;
    const updatedTags = tags !== undefined ? tags.trim() : existing.tags;
    const updatedConclusion = conclusion !== undefined ? conclusion.trim() : existing.conclusion;
    const updatedStatus = status !== undefined ? status : existing.status;

    let imageUrl = existing.image_url || null;
    let imagePublicId = existing.image_public_id || null;
    if (image) {
      imageUrl = image.url;
      imagePublicId = image.publicId;
    } else if (removeImage) {
      imageUrl = null;
      imagePublicId = null;
    }

    if (updatedStatus === 'Scheduled') {
      if (!scheduledAt) throw httpError(400, 'A scheduled publication time is required for Scheduled blogs');
      // One atomic statement: it only matches while the blog is still Draft/Scheduled, so it can never
      // pull a blog back from Published (e.g. one the cron job just published) - 0 rows => 409.
      const [r] = await withMigrationHint(() =>
        db.query(
          "UPDATE blogs SET title = ?, content = ?, tags = ?, conclusion = ?, status = 'Scheduled', image_url = ?, image_public_id = ?, scheduled_at = ? WHERE id = ? AND status IN ('Draft', 'Scheduled')",
          [updatedTitle, updatedContent, updatedTags, updatedConclusion, imageUrl, imagePublicId, toMysqlUtc(scheduledAt), existing.id]
        )
      );
      if (!r?.affectedRows) {
        throw httpError(409, 'This blog is already published and cannot be scheduled', 'ALREADY_PUBLISHED');
      }
      return toPublicBlog(await this.getRawByInternalId(existing.id));
    }

    const sql =
      'UPDATE blogs SET title = ?, content = ?, tags = ?, conclusion = ?, status = ?, image_url = ?, image_public_id = ? WHERE id = ?';
    const params = [
      updatedTitle,
      updatedContent,
      updatedTags,
      updatedConclusion,
      updatedStatus,
      imageUrl,
      imagePublicId,
      existing.id,
    ];

    await db.query(sql, params);
    // Leaving the Scheduled state (saved as Draft = cancel, or published now): drop the pending time.
    if (existing.status === 'Scheduled') {
      await db.query('UPDATE blogs SET scheduled_at = NULL WHERE id = ?', [existing.id]);
    }
    return toPublicBlog(await this.getRawByInternalId(existing.id));
  },

  /**
   * Admin: schedule (Draft -> Scheduled) or reschedule (Scheduled -> Scheduled). `scheduledAt` is a
   * validated future Date. Returns the blog, null if it does not exist; throws 409 if already Published.
   */
  async scheduleBlog(blogId, scheduledAt) {
    const existing = await this.getRawByBlogId(blogId);
    if (!existing) return null;
    const conflict = () => httpError(409, 'This blog is already published and cannot be scheduled', 'ALREADY_PUBLISHED');
    if (existing.status === 'Published') throw conflict();
    const [r] = await withMigrationHint(() =>
      db.query("UPDATE blogs SET status = 'Scheduled', scheduled_at = ? WHERE id = ? AND status IN ('Draft', 'Scheduled')", [
        toMysqlUtc(scheduledAt),
        existing.id,
      ])
    );
    if (!r?.affectedRows) throw conflict(); // published by the cron job between the read and the write
    return toPublicBlog(await this.getRawByInternalId(existing.id));
  },

  /**
   * Admin: cancel a scheduled publication. Documented behaviour: the blog goes back to Draft, its
   * content is untouched and the cron job will never publish it. 409 if it is not Scheduled.
   */
  async cancelSchedule(blogId) {
    const existing = await this.getRawByBlogId(blogId);
    if (!existing) return null;
    const conflict = () => httpError(409, 'This blog is not scheduled', 'NOT_SCHEDULED');
    if (existing.status !== 'Scheduled') throw conflict();
    const [r] = await db.query("UPDATE blogs SET status = 'Draft', scheduled_at = NULL WHERE id = ? AND status = 'Scheduled'", [existing.id]);
    if (!r?.affectedRows) throw conflict();
    return toPublicBlog(await this.getRawByInternalId(existing.id));
  },

  /**
   * Admin: Deletes a blog by public blog_id. The counter is never decremented,
   * so the deleted blog_id is never handed out again.
   */
  async deleteBlog(blogId) {
    const existing = await this.getRawByBlogId(blogId);
    if (!existing) {
      return false;
    }

    await db.query('DELETE FROM blogs WHERE id = ?', [existing.id]);
    return true;
  },

  /**
   * Admin: Retrieves aggregated dashboard statistics
   */
  async getDashboardStats() {
    const [totalRows] = await db.query('SELECT COUNT(*) AS total FROM blogs');
    const [publishedRows] = await db.query(
      "SELECT COUNT(*) AS published FROM blogs WHERE status = 'Published'"
    );
    const [draftRows] = await db.query(
      "SELECT COUNT(*) AS drafts FROM blogs WHERE status = 'Draft'"
    );
    const [recentRows] = await db.query(
      'SELECT * FROM blogs ORDER BY created_at DESC LIMIT 6'
    );

    const totalBlogs = Number(totalRows[0]?.total || 0);
    const publishedBlogs = Number(publishedRows[0]?.published || 0);
    const draftBlogs = Number(draftRows[0]?.drafts || 0);

    let scheduledBlogs = 0;
    try {
      const [scheduledRows] = await db.query("SELECT COUNT(*) AS scheduled FROM blogs WHERE status = 'Scheduled'");
      scheduledBlogs = Number(scheduledRows[0]?.scheduled || 0);
    } catch (err) {
      // migration 004 not applied yet: no Scheduled status exists
    }

    return {
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      scheduledBlogs,
      recentBlogs: toPublicBlogs(recentRows),
      dbStatus: db.getDBStatus(),
    };
  },
};

export default blogService;
