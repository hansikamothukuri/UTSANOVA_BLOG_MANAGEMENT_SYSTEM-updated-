import db from '../config/db.js';

export const blogService = {
  /**
   * Retrieves published blogs with optional search and tag filters, paginated
   * using LIMIT/OFFSET at the database level plus a separate COUNT(*) query
   * for total-record metadata.
   */
  async getPublishedBlogs({ search, tag, page = 1, limit = 9 } = {}) {
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

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const [countRows] = await db.query(countSql, params);
    const totalBlogs = Number(countRows[0]?.total || 0);
    const totalPages = totalBlogs > 0 ? Math.ceil(totalBlogs / limit) : 0;
    const offset = (page - 1) * limit;

    const [rows] = await db.query(sql, [...params, limit, offset]);

    return {
      blogs: rows,
      pagination: {
        currentPage: page,
        limit,
        totalBlogs,
        totalPages,
      },
    };
  },

  /**
   * Retrieves single published blog by ID
   */
  async getPublishedBlogById(id) {
    const sql = "SELECT * FROM blogs WHERE id = ? AND status = 'Published'";
    const [rows] = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Admin: Retrieves all blogs with optional status filter
   */
  async getAllBlogs({ status } = {}) {
    let sql = 'SELECT * FROM blogs';
    const params = [];

    if (status && ['Draft', 'Published'].includes(status)) {
      sql += ' WHERE status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    return rows;
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

    if (status && ['Draft', 'Published'].includes(status)) {
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
      blogs: rows,
      pagination: {
        currentPage,
        limit,
        totalBlogs,
        totalPages,
      },
    };
  },

  /**
   * Admin: Retrieves single blog by ID
   */
  async getBlogById(id) {
    const sql = 'SELECT * FROM blogs WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows.length > 0 ? rows[0] : null;
  },

  /**
   * Admin: Creates a new blog
   */
  async createBlog({ title, content, tags, conclusion, status }) {
    const sql =
      'INSERT INTO blogs (title, content, tags, conclusion, status) VALUES (?, ?, ?, ?, ?)';
    const params = [title.trim(), content.trim(), tags.trim(), conclusion.trim(), status];

    const [result] = await db.query(sql, params);
    const insertId = result.insertId || result[0]?.insertId;

    if (insertId) {
      return await this.getBlogById(insertId);
    }
    return null;
  },

  /**
   * Admin: Updates an existing blog
   */
  async updateBlog(id, { title, content, tags, conclusion, status }) {
    const existing = await this.getBlogById(id);
    if (!existing) {
      return null;
    }

    const updatedTitle = title !== undefined ? title.trim() : existing.title;
    const updatedContent = content !== undefined ? content.trim() : existing.content;
    const updatedTags = tags !== undefined ? tags.trim() : existing.tags;
    const updatedConclusion = conclusion !== undefined ? conclusion.trim() : existing.conclusion;
    const updatedStatus = status !== undefined ? status : existing.status;

    const sql =
      'UPDATE blogs SET title = ?, content = ?, tags = ?, conclusion = ?, status = ? WHERE id = ?';
    const params = [updatedTitle, updatedContent, updatedTags, updatedConclusion, updatedStatus, id];

    await db.query(sql, params);
    return await this.getBlogById(id);
  },

  /**
   * Admin: Deletes a blog by ID
   */
  async deleteBlog(id) {
    const existing = await this.getBlogById(id);
    if (!existing) {
      return false;
    }

    const sql = 'DELETE FROM blogs WHERE id = ?';
    await db.query(sql, [id]);
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

    return {
      totalBlogs,
      publishedBlogs,
      draftBlogs,
      recentBlogs: recentRows || [],
      dbStatus: db.getDBStatus(),
    };
  },
};

export default blogService;
