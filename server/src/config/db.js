import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

let pool = null;
let useFallbackStorage = false;

// Persistent fallback storage path when remote MySQL server is not configured/reachable
const STORAGE_FILE = path.resolve(process.cwd(), 'utsanova_blog_data.json');

// Initial seed data for fallback storage
const DEFAULT_FALLBACK_STATE = {
  admins: [
    {
      id: 1,
      firebase_uid: 'admin_default_uid_utsanova',
      email: 'admin@utsanova.com',
      name: 'Utsanova Administrator',
      created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
    {
      id: 2,
      firebase_uid: 'demo-admin-uid-123',
      email: 'admin@utsanova.com',
      name: 'Utsanova Superadmin',
      created_at: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    },
  ],
  blogs: [
    {
      id: 1,
      blog_id: '0001',
      title: 'The Future of Technology in Modern Education',
      content:
        'In recent years, higher education and engineering training have undergone a massive digital transformation. From interactive cloud laboratories to personalized learning pathways, modern educational systems are bridging the gap between academic theory and industry requirements. At Utsanova Technologies, our mission is to empower learners through immersive real-world project experiences and cutting-edge digital infrastructure.',
      tags: 'Technology, Education, Web Development',
      conclusion:
        'Embracing emerging technologies is no longer optional for academic institutions. By blending real-world software practices with pedagogy, we prepare the next generation of engineers for long-term career success.',
      status: 'Published',
      image_url: null,
      image_public_id: null,
      created_at: '2026-09-15 10:30:00',
      updated_at: '2026-09-15 10:30:00',
    },
    {
      id: 2,
      blog_id: '0002',
      title: 'How to Build Better Products with React and Vite',
      content:
        'Speed, developer ergonomics, and rock-solid architecture are the cornerstones of successful web software today. Moving to modern build systems like Vite drastically reduces cold start times and provides lightning-fast hot module replacement. When paired with modular component hierarchies, strict type definitions, and reliable state management, development teams can ship responsive products with confidence.',
      tags: 'React, Web Development, Technology',
      conclusion:
        'Modern tooling empowers teams to spend less time configuring boilerplate and more time delivering tangible value to end users.',
      status: 'Published',
      image_url: null,
      image_public_id: null,
      created_at: '2026-09-18 14:15:00',
      updated_at: '2026-09-18 14:15:00',
    },
    {
      id: 3,
      blog_id: '0003',
      title: 'Career Growth in 2026: Navigating the Tech Industry',
      content:
        'The tech ecosystem continues to reward individuals who master core fundamental software engineering principles alongside adaptive problem solving. Whether you are learning full-stack development, cloud deployment pipelines, or database optimizations, having strong hands-on project experience distinguishes you from the crowd. Building end-to-end full-stack systems is the highest-leverage skill an intern or junior engineer can develop.',
      tags: 'Career, Students, Education',
      conclusion:
        'Consistency, deep curiosity, and building verified production-grade projects are the true catalysts for long-term career growth in technology.',
      status: 'Published',
      image_url: null,
      image_public_id: null,
      created_at: '2026-09-20 09:00:00',
      updated_at: '2026-09-20 09:00:00',
    },
    {
      id: 4,
      blog_id: '0004',
      title: 'Designing Scalable Relational Database Schemas',
      content:
        'Relational databases remain the backbone of mission-critical business applications. Proper normalization, defensive indexing on query filters, and strict validation layers ensure high throughput and data integrity as user traffic scales. Understanding transactional boundaries and query performance profiling prevents expensive system bottlenecks.',
      tags: 'Technology, Web Development',
      conclusion:
        'A well-architected relational model pays compounding dividends throughout the entire product lifecycle.',
      status: 'Published',
      image_url: null,
      image_public_id: null,
      created_at: '2026-09-22 16:45:00',
      updated_at: '2026-09-22 16:45:00',
    },
    {
      id: 5,
      blog_id: '0005',
      title: 'Upcoming Platform Upgrades: Internal Architecture Notes',
      content:
        'This is an internal draft outlining the roadmap for Utsanova blog system enhancements, including scheduled publishing pipelines and granular role-based permissions.',
      tags: 'Technology, Career',
      conclusion:
        'Review scheduled for next engineering sprint before public release.',
      status: 'Draft',
      image_url: null,
      image_public_id: null,
      created_at: '2026-09-24 11:20:00',
      updated_at: '2026-09-24 11:20:00',
    },
  ],
  nextBlogId: 6,
  nextAdminId: 3,
  lastPublicBlogId: 5,
};

// Dev-only migration for an existing local JSON file: give every blog a 4-digit blog_id
// (oldest first) and add the image columns. Mirrors database/migrations/001_*.sql.
const migrateFallbackData = (data) => {
  let changed = false;
  const blogs = Array.isArray(data.blogs) ? data.blogs : [];
  let last = Number(data.lastPublicBlogId) || 0;
  for (const b of blogs) {
    if (b.blog_id) last = Math.max(last, Number(b.blog_id) || 0);
  }
  [...blogs]
    .filter((b) => !b.blog_id)
    .sort((a, b) => Number(a.id) - Number(b.id))
    .forEach((b) => {
      last += 1;
      b.blog_id = String(last).padStart(4, '0');
      changed = true;
    });
  for (const b of blogs) {
    if (b.image_url === undefined) { b.image_url = null; changed = true; }
    if (b.image_public_id === undefined) { b.image_public_id = null; changed = true; }
  }
  // Mirrors database/migrations/002_*.sql: views counter + blog_likes table
  for (const b of blogs) {
    if (b.views === undefined) { b.views = 0; changed = true; }
  }
  if (!Array.isArray(data.blog_likes)) { data.blog_likes = []; changed = true; }
  // Mirrors database/migrations/003_*.sql: blog_comments table (existing blogs are untouched)
  if (!Array.isArray(data.blog_comments)) { data.blog_comments = []; changed = true; }
  if (data.lastPublicBlogId !== last) { data.lastPublicBlogId = last; changed = true; }
  return changed;
};

const getFallbackData = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      const data = JSON.parse(raw);
      if (migrateFallbackData(data)) saveFallbackData(data);
      return data;
    }
  } catch (err) {
    console.error('Error reading fallback storage file, resetting to default:', err);
  }
  const fresh = JSON.parse(JSON.stringify(DEFAULT_FALLBACK_STATE));
  migrateFallbackData(fresh); // adds views / blog_likes defaults
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(fresh, null, 2), 'utf-8');
  return fresh;
};

/**
 * Applies the public-list filters of blogService.getPublishedBlogs to the fallback blogs.
 * Mirrors the SQL it receives, and consumes params in the order the service builds them:
 *   [ '%tag%' ]            when "... status = 'Published' AND tags LIKE ?" is present
 *   [ '%q%','%q%','%q%' ]  when "AND (title LIKE ? OR content LIKE ? OR tags LIKE ?)" is present
 *   [ limit, offset ]      (handled by the caller)
 * Each filter reads ITS OWN param, so tag + search together require both to match, and a
 * search-only query never triggers the tag filter (its clause also contains "tags LIKE ?").
 */
const applyPublishedBlogFilters = (blogs, sqlText, params) => {
  let result = blogs.filter((b) => b.status === 'Published');
  const needle = (v) => String(v ?? '').replace(/^%|%$/g, '').toLowerCase();
  let i = 0;

  if (/status\s*=\s*['"]Published['"]\s+AND\s+tags\s+LIKE\s+\?/i.test(sqlText)) {
    const tag = needle(params[i++]);
    result = result.filter((b) => (b.tags || '').toLowerCase().includes(tag));
  }

  if (/\(\s*title\s+LIKE\s+\?\s+OR\s+content\s+LIKE\s+\?\s+OR\s+tags\s+LIKE\s+\?\s*\)/i.test(sqlText)) {
    const term = needle(params[i]);
    i += 3;
    result = result.filter(
      (b) =>
        (b.title || '').toLowerCase().includes(term) ||
        (b.content || '').toLowerCase().includes(term) ||
        (b.tags || '').toLowerCase().includes(term)
    );
  }

  return result;
};

const saveFallbackData = (data) => {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving fallback storage file:', err);
  }
};

// In production (Vercel / NODE_ENV=production) the local JSON fallback is NEVER used:
// the serverless filesystem is read-only/ephemeral and the fallback contains demo admins.
const isProduction = Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production';

const buildSslOptions = () => {
  if (String(process.env.DATABASE_SSL).toLowerCase() !== 'true') return undefined;
  const ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  if (process.env.DATABASE_SSL_CA) {
    ssl.ca = process.env.DATABASE_SSL_CA.replace(/\\n/g, '\n');
  }
  return ssl;
};

let initPromise = null;

const doInit = async () => {
  const host = process.env.DATABASE_HOST;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;
  const database = process.env.DATABASE_NAME || 'utsanova_blog';
  const port = Number(process.env.DATABASE_PORT) || 3306;

  if (host && user) {
    console.log(`[MySQL] Creating pool for ${host}:${port}/${database}...`);
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      ssl: buildSslOptions(),
      waitForConnections: true,
      // Each serverless instance has its own pool: keep it small so many instances
      // do not exhaust the MySQL server's max_connections.
      connectionLimit: Number(process.env.DATABASE_POOL_LIMIT) || 3,
      maxIdle: Number(process.env.DATABASE_POOL_LIMIT) || 3,
      idleTimeout: 60000,
      queueLimit: 0,
      connectTimeout: 10000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
    useFallbackStorage = false;

    if (isProduction) {
      // No eager connection test: a failing DB surfaces as an error on the request
      // instead of silently switching to a fake data store.
      return;
    }

    try {
      const connection = await pool.getConnection();
      console.log(`[MySQL] Successfully connected to MySQL database: ${database}`);
      connection.release();
      return;
    } catch (err) {
      console.warn(`[MySQL] Could not connect to MySQL server (${err.message}). Activating local relational engine (dev only).`);
      pool = null;
      useFallbackStorage = true;
    }
  } else if (isProduction) {
    throw new Error('MySQL is not configured: set DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME');
  } else {
    console.log('[MySQL] DATABASE_HOST not set in environment. Using local file-persisted relational database (dev only).');
    useFallbackStorage = true;
  }

  // Ensure storage file exists (local development only)
  getFallbackData();
};

/**
 * Initializes the MySQL connection pool once per serverless instance (memoized).
 * A failed init is not cached, so the next request retries.
 */
export const initDB = () => {
  if (!initPromise) {
    initPromise = doInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
};

/**
 * Unified query method for all backend services
 * Accepts parameterized queries (SQL + params array)
 */
export const query = async (sql, params = []) => {
  await initDB();
  if (!useFallbackStorage && pool) {
    try {
      const [rows] = await pool.query(sql, params);
      return [rows];
    } catch (error) {
      console.error('[MySQL Query Error]:', error.message, 'SQL:', sql);
      throw error;
    }
  }

  // Local fallback relational executor
  const data = getFallbackData();
  const trimmed = sql.trim();

  // 00. View counter + likes (mirrors migration 002). Must stay above the generic blogs rules.
  if (/UPDATE\s+blogs\s+SET\s+views\s*=\s*views\s*\+\s*1\s+WHERE\s+blog_id\s*=\s*\?\s+AND\s+status\s*=\s*['\"]Published['\"]/i.test(trimmed)) {
    const blog = data.blogs.find((b) => b.blog_id === String(params[0]) && b.status === 'Published');
    if (!blog) return [{ affectedRows: 0 }];
    blog.views = (Number(blog.views) || 0) + 1;
    saveFallbackData(data);
    return [{ affectedRows: 1 }];
  }
  if (/INSERT\s+INTO\s+blog_likes/i.test(trimmed)) {
    const [blogInternalId, uid] = params;
    const likes = data.blog_likes;
    if (likes.some((l) => Number(l.blog_id) === Number(blogInternalId) && l.firebase_uid === uid)) {
      return [{ affectedRows: 0 }]; // UNIQUE (blog_id, firebase_uid)
    }
    likes.push({
      id: likes.reduce((m, l) => Math.max(m, l.id), 0) + 1,
      blog_id: Number(blogInternalId),
      firebase_uid: uid,
      created_at: new Date().toISOString(),
    });
    saveFallbackData(data);
    return [{ affectedRows: 1 }];
  }
  if (/DELETE\s+FROM\s+blog_likes\s+WHERE\s+blog_id\s*=\s*\?\s+AND\s+firebase_uid\s*=\s*\?/i.test(trimmed)) {
    const [blogInternalId, uid] = params;
    const before = data.blog_likes.length;
    data.blog_likes = data.blog_likes.filter(
      (l) => !(Number(l.blog_id) === Number(blogInternalId) && l.firebase_uid === uid)
    );
    saveFallbackData(data);
    return [{ affectedRows: before - data.blog_likes.length }];
  }
  if (/SELECT\s+COUNT\(\*\)\s+AS\s+like_count\s+FROM\s+blog_likes\s+WHERE\s+blog_id\s*=\s*\?/i.test(trimmed)) {
    const n = data.blog_likes.filter((l) => Number(l.blog_id) === Number(params[0])).length;
    return [[{ like_count: n }]];
  }
  if (/SELECT\s+id\s+FROM\s+blog_likes\s+WHERE\s+blog_id\s*=\s*\?\s+AND\s+firebase_uid\s*=\s*\?/i.test(trimmed)) {
    const found = data.blog_likes.filter(
      (l) => Number(l.blog_id) === Number(params[0]) && l.firebase_uid === params[1]
    );
    return [found.slice(0, 1).map((l) => ({ id: l.id }))];
  }

  // 01. Comments (mirrors migration 003). Joined with admins to resolve the author's name.
  if (/INSERT\s+INTO\s+blog_comments/i.test(trimmed)) {
    const [blogInternalId, uid, content] = params;
    const comments = data.blog_comments;
    const newComment = {
      id: comments.reduce((m, c) => Math.max(m, c.id), 0) + 1,
      blog_id: Number(blogInternalId),
      firebase_uid: uid,
      content,
      created_at: new Date().toISOString(),
    };
    comments.push(newComment);
    saveFallbackData(data);
    return [{ insertId: newComment.id, affectedRows: 1 }];
  }
  if (/FROM\s+blog_comments\s+c\s+LEFT\s+JOIN\s+admins\s+a/i.test(trimmed)) {
    const withAuthor = (c) => {
      const admin = data.admins.find((a) => a.firebase_uid === c.firebase_uid);
      return { id: c.id, content: c.content, created_at: c.created_at, author_name: admin ? admin.name : null };
    };
    if (/WHERE\s+c\.id\s*=\s*\?/i.test(trimmed)) {
      return [data.blog_comments.filter((c) => Number(c.id) === Number(params[0])).map(withAuthor)];
    }
    // WHERE c.blog_id = ? ORDER BY c.created_at ASC, c.id ASC (oldest first)
    const list = data.blog_comments
      .filter((c) => Number(c.blog_id) === Number(params[0]))
      .sort((x, y) => new Date(x.created_at) - new Date(y.created_at) || x.id - y.id)
      .map(withAuthor);
    return [list];
  }

  // 02. Related posts candidates: published, other blog, tags LIKE any of the given %tag% patterns.
  if (/WHERE\s+status\s*=\s*['"]Published['"]\s+AND\s+id\s*<>\s*\?\s+AND\s+\(tags\s+LIKE\s+\?/i.test(trimmed)) {
    const [excludeId, ...patterns] = params;
    const needles = patterns.map((p) => String(p).replace(/^%|%$/g, '').toLowerCase());
    const result = data.blogs
      .filter(
        (b) =>
          b.status === 'Published' &&
          Number(b.id) !== Number(excludeId) &&
          needles.some((n) => (b.tags || '').toLowerCase().includes(n))
      )
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || Number(b.id) - Number(a.id))
      .slice(0, 100);
    return [result];
  }

  // 0. Admin blog list (status / search filters + LIMIT/OFFSET) and its matching COUNT.
  // Param order mirrors blogService.getAdminBlogs: [status?], [term, term, term]?, [limit, offset]?
  if (/FROM\s+blogs\s+WHERE\s+1\s*=\s*1/i.test(trimmed)) {
    let result = [...data.blogs];
    let idx = 0;

    if (/AND\s+status\s*=\s*\?/i.test(trimmed)) {
      const status = params[idx++];
      result = result.filter((b) => b.status === status);
    }

    if (/title\s+LIKE\s+\?/i.test(trimmed)) {
      const term = String(params[idx] ?? '').replace(/^%|%$/g, '').toLowerCase();
      idx += 3;
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(term) ||
          b.content.toLowerCase().includes(term) ||
          b.tags.toLowerCase().includes(term)
      );
    }

    if (/COUNT\(\*\)/i.test(trimmed)) {
      return [[{ total: result.length }]];
    }

    result.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime() ||
        Number(b.id) - Number(a.id)
    );

    if (/LIMIT\s+\?\s+OFFSET\s+\?/i.test(trimmed)) {
      const limit = Number(params[params.length - 2]) || 9;
      const offset = Number(params[params.length - 1]) || 0;
      result = result.slice(offset, offset + limit);
    }

    return [result];
  }

  // 1. SELECT COUNT queries for stats / pagination totals
  if (/SELECT\s+COUNT\(\*\)\s+AS\s+total\s+FROM\s+blogs\s+WHERE\s+status\s*=\s*['"]Published['"]/i.test(trimmed)) {
    // Pagination count: apply the same tag/search filters as the matching SELECT below
    const result = applyPublishedBlogFilters(data.blogs, trimmed, params);

    return [[{ total: result.length }]];
  }
  if (/SELECT\s+COUNT\(\*\)\s+AS\s+total\s+FROM\s+blogs/i.test(trimmed)) {
    return [[{ total: data.blogs.length }]];
  }
  if (/SELECT\s+COUNT\(\*\)\s+AS\s+published\s+FROM\s+blogs\s+WHERE\s+status\s*=\s*['"]Published['"]/i.test(trimmed)) {
    const published = data.blogs.filter((b) => b.status === 'Published').length;
    return [[{ published }]];
  }
  if (/SELECT\s+COUNT\(\*\)\s+AS\s+drafts\s+FROM\s+blogs\s+WHERE\s+status\s*=\s*['"]Draft['"]/i.test(trimmed)) {
    const drafts = data.blogs.filter((b) => b.status === 'Draft').length;
    return [[{ drafts }]];
  }

  // 2. SELECT admins
  if (/SELECT\s+\*\s+FROM\s+admins\s+WHERE\s+firebase_uid\s*=\s*\?/i.test(trimmed)) {
    const uid = params[0];
    const admin = data.admins.filter((a) => a.firebase_uid === uid);
    return [admin];
  }
  if (/SELECT\s+\*\s+FROM\s+admins\s+WHERE\s+email\s*=\s*\?/i.test(trimmed)) {
    const email = (params[0] || '').toLowerCase().trim();
    const admin = data.admins.filter((a) => (a.email || '').toLowerCase().trim() === email);
    return [admin];
  }
  if (/SELECT\s+\*\s+FROM\s+admins\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
    const id = Number(params[0]);
    const admin = data.admins.filter((a) => Number(a.id) === id);
    return [admin];
  }
  if (/SELECT\s+(\*|id,\s*firebase_uid,\s*email,\s*name,\s*created_at)\s+FROM\s+admins/i.test(trimmed)) {
    return [[...data.admins]];
  }

  // 3. INSERT INTO admins
  if (/INSERT\s+INTO\s+admins/i.test(trimmed)) {
    const [firebase_uid, email, name] = params;
    const existing = data.admins.find((a) => a.firebase_uid === firebase_uid);
    if (existing) {
      return [{ insertId: existing.id, affectedRows: 0 }];
    }
    const newAdmin = {
      id: data.nextAdminId++,
      firebase_uid,
      email,
      name: name || 'Admin User',
      created_at: new Date().toISOString(),
    };
    data.admins.push(newAdmin);
    saveFallbackData(data);
    return [{ insertId: newAdmin.id, affectedRows: 1 }];
  }

  // 3b. UPDATE admins
  if (/UPDATE\s+admins\s+SET/i.test(trimmed)) {
    if (/firebase_uid\s*=\s*\?\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
      const [uid, id] = params;
      const admin = data.admins.find((a) => Number(a.id) === Number(id));
      if (admin) {
        admin.firebase_uid = uid;
        saveFallbackData(data);
        return [{ affectedRows: 1 }];
      }
    }
    if (/firebase_uid\s*=\s*\?\s+WHERE\s+email\s*=\s*\?/i.test(trimmed)) {
      const [uid, email] = params;
      const admin = data.admins.find((a) => (a.email || '').toLowerCase() === (email || '').toLowerCase());
      if (admin) {
        admin.firebase_uid = uid;
        saveFallbackData(data);
        return [{ affectedRows: 1 }];
      }
    }
    return [{ affectedRows: 0 }];
  }

  // 3c. Lookup by public 4-digit blog_id
  if (/SELECT\s+\*\s+FROM\s+blogs\s+WHERE\s+blog_id\s*=\s*\?\s+AND\s+status\s*=\s*['"]Published['"]/i.test(trimmed)) {
    return [data.blogs.filter((b) => b.blog_id === String(params[0]) && b.status === 'Published')];
  }
  if (/SELECT\s+\*\s+FROM\s+blogs\s+WHERE\s+blog_id\s*=\s*\?/i.test(trimmed)) {
    return [data.blogs.filter((b) => b.blog_id === String(params[0]))];
  }

  // 4. SELECT * FROM blogs WHERE id = ? AND status = 'Published'
  if (/SELECT\s+\*\s+FROM\s+blogs\s+WHERE\s+id\s*=\s*\?\s+AND\s+status\s*=\s*['"]Published['"]/i.test(trimmed)) {
    const id = Number(params[0]);
    const blog = data.blogs.filter((b) => Number(b.id) === id && b.status === 'Published');
    return [blog];
  }

  // 5. SELECT * FROM blogs WHERE id = ?
  if (/SELECT\s+\*\s+FROM\s+blogs\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
    const id = Number(params[0]);
    const blog = data.blogs.filter((b) => Number(b.id) === id);
    return [blog];
  }

  // 6. SELECT * FROM blogs WHERE status = 'Published' (with optional search / tag)
  if (/SELECT\s+\*\s+FROM\s+blogs\s+WHERE\s+status\s*=\s*['"]Published['"]/i.test(trimmed)) {
    let result = applyPublishedBlogFilters(data.blogs, trimmed, params);

    // Sorting (mirrors BLOG_SORT_SQL): popular = views DESC, oldest = created_at ASC, default newest first.
    // `id` is the tie-breaker, like in the SQL.
    const byDateDesc = (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || Number(b.id) - Number(a.id);
    if (/ORDER\s+BY\s+views\s+DESC/i.test(trimmed)) {
      result.sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0) || byDateDesc(a, b));
    } else if (/ORDER\s+BY\s+created_at\s+ASC/i.test(trimmed)) {
      result.sort((a, b) => -byDateDesc(a, b));
    } else {
      result.sort(byDateDesc);
    }

    // Pagination: LIMIT ? OFFSET ? are appended as the last two params
    if (/LIMIT\s+\?\s+OFFSET\s+\?/i.test(trimmed)) {
      const limit = Number(params[params.length - 2]) || 9;
      const offset = Number(params[params.length - 1]) || 0;
      result = result.slice(offset, offset + limit);
    }

    return [result];
  }

  // 7. SELECT * FROM blogs ORDER BY created_at DESC (Admin view)
  if (/SELECT\s+\*\s+FROM\s+blogs/i.test(trimmed)) {
    let result = [...data.blogs];
    if (params.length > 0 && /status\s*=\s*\?/i.test(trimmed)) {
      result = result.filter((b) => b.status === params[0]);
    }
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return [result];
  }

  // 8. INSERT INTO blogs
  if (/INSERT\s+INTO\s+blogs/i.test(trimmed)) {
    // [blog_id, title, content, tags, conclusion, status, image_url, image_public_id]
    const [blog_id, title, content, tags, conclusion, status, image_url, image_public_id] = params;
    if (data.blogs.some((b) => b.blog_id === blog_id)) {
      const dup = new Error(`Duplicate entry '${blog_id}' for key 'uq_blogs_blog_id'`);
      dup.code = 'ER_DUP_ENTRY';
      throw dup;
    }
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newBlog = {
      id: data.nextBlogId++,
      blog_id,
      title,
      content,
      tags,
      conclusion,
      status: status || 'Draft',
      image_url: image_url ?? null,
      image_public_id: image_public_id ?? null,
      views: 0,
      created_at: now,
      updated_at: now,
    };
    data.blogs.unshift(newBlog);
    saveFallbackData(data);
    return [{ insertId: newBlog.id, affectedRows: 1 }];
  }

  // 9. UPDATE blogs SET ... WHERE id = ?
  if (/UPDATE\s+blogs\s+SET/i.test(trimmed)) {
    const id = Number(params[params.length - 1]);
    const blogIndex = data.blogs.findIndex((b) => Number(b.id) === id);
    if (blogIndex === -1) {
      return [{ affectedRows: 0 }];
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    // Full update: [title, content, tags, conclusion, status, image_url, image_public_id, id]
    // (blog_id is never part of an UPDATE, so it can't change on edit)
    if (params.length >= 8) {
      const [title, content, tags, conclusion, status, image_url, image_public_id] = params;
      data.blogs[blogIndex] = {
        ...data.blogs[blogIndex],
        title,
        content,
        tags,
        conclusion,
        status,
        image_url: image_url ?? null,
        image_public_id: image_public_id ?? null,
        updated_at: now,
      };
    } else if (params.length >= 6) {
      const [title, content, tags, conclusion, status] = params;
      data.blogs[blogIndex] = {
        ...data.blogs[blogIndex],
        title,
        content,
        tags,
        conclusion,
        status,
        updated_at: now,
      };
    } else if (params.length === 2) {
      // e.g. status change: [status, id]
      data.blogs[blogIndex].status = params[0];
      data.blogs[blogIndex].updated_at = now;
    }

    saveFallbackData(data);
    return [{ affectedRows: 1 }];
  }

  // 10. DELETE FROM blogs WHERE id = ?
  if (/DELETE\s+FROM\s+blogs\s+WHERE\s+id\s*=\s*\?/i.test(trimmed)) {
    const id = Number(params[0]);
    const initialLength = data.blogs.length;
    data.blogs = data.blogs.filter((b) => Number(b.id) !== id);
    data.blog_likes = (data.blog_likes || []).filter((l) => Number(l.blog_id) !== id);
    data.blog_comments = (data.blog_comments || []).filter((c) => Number(c.blog_id) !== id);
    const affected = initialLength - data.blogs.length;
    saveFallbackData(data);
    return [{ affectedRows: affected }];
  }

  return [[]];
};

export const MAX_PUBLIC_BLOG_ID = 9999;

/**
 * Allocates the next public 4-digit Blog ID ('0001'..'9999').
 *
 * MySQL: increments the single-row blog_id_counter table with LAST_INSERT_ID(expr), which is
 * atomic (row lock) and per-connection, so concurrent requests / serverless instances can never
 * receive the same number. The counter only increases, so a deleted blog's ID is never reused.
 * (If the following INSERT fails, that number is simply skipped - uniqueness matters more than
 * gap-free numbering.)
 */
export const nextPublicBlogId = async () => {
  await initDB();
  let next;

  if (!useFallbackStorage && pool) {
    const conn = await pool.getConnection();
    try {
      const [upd] = await conn.query(
        'UPDATE blog_id_counter SET last_value = LAST_INSERT_ID(last_value + 1) WHERE id = 1'
      );
      if (!upd.affectedRows) {
        throw new Error(
          'blog_id_counter is not initialised. Run database/migrations/001_add_blog_id_and_image.sql.'
        );
      }
      const [rows] = await conn.query('SELECT LAST_INSERT_ID() AS next_id');
      next = Number(rows[0].next_id);
    } finally {
      conn.release();
    }
  } else {
    const data = getFallbackData();
    next = (Number(data.lastPublicBlogId) || 0) + 1;
    data.lastPublicBlogId = next;
    saveFallbackData(data);
  }

  if (next > MAX_PUBLIC_BLOG_ID) {
    const err = new Error('The 4-digit Blog ID range (0001-9999) is exhausted.');
    err.statusCode = 507;
    err.expose = true;
    throw err;
  }
  return String(next).padStart(4, '0');
};

export const getDBStatus = () => {
  return {
    isMySQL: !useFallbackStorage && !!pool,
    databaseName: process.env.DATABASE_NAME || 'utsanova_blog',
    storageMode: !useFallbackStorage && pool ? 'MySQL (Remote Pool)' : 'Embedded Relational (utsanova_blog_data.json)',
  };
};

export default {
  initDB,
  query,
  nextPublicBlogId,
  getDBStatus,
};
