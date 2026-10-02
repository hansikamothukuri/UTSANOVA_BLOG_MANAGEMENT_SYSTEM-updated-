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
      title: 'The Future of Technology in Modern Education',
      content:
        'In recent years, higher education and engineering training have undergone a massive digital transformation. From interactive cloud laboratories to personalized learning pathways, modern educational systems are bridging the gap between academic theory and industry requirements. At Utsanova Technologies, our mission is to empower learners through immersive real-world project experiences and cutting-edge digital infrastructure.',
      tags: 'Technology, Education, Web Development',
      conclusion:
        'Embracing emerging technologies is no longer optional for academic institutions. By blending real-world software practices with pedagogy, we prepare the next generation of engineers for long-term career success.',
      status: 'Published',
      created_at: '2026-09-15 10:30:00',
      updated_at: '2026-09-15 10:30:00',
    },
    {
      id: 2,
      title: 'How to Build Better Products with React and Vite',
      content:
        'Speed, developer ergonomics, and rock-solid architecture are the cornerstones of successful web software today. Moving to modern build systems like Vite drastically reduces cold start times and provides lightning-fast hot module replacement. When paired with modular component hierarchies, strict type definitions, and reliable state management, development teams can ship responsive products with confidence.',
      tags: 'React, Web Development, Technology',
      conclusion:
        'Modern tooling empowers teams to spend less time configuring boilerplate and more time delivering tangible value to end users.',
      status: 'Published',
      created_at: '2026-09-18 14:15:00',
      updated_at: '2026-09-18 14:15:00',
    },
    {
      id: 3,
      title: 'Career Growth in 2026: Navigating the Tech Industry',
      content:
        'The tech ecosystem continues to reward individuals who master core fundamental software engineering principles alongside adaptive problem solving. Whether you are learning full-stack development, cloud deployment pipelines, or database optimizations, having strong hands-on project experience distinguishes you from the crowd. Building end-to-end full-stack systems is the highest-leverage skill an intern or junior engineer can develop.',
      tags: 'Career, Students, Education',
      conclusion:
        'Consistency, deep curiosity, and building verified production-grade projects are the true catalysts for long-term career growth in technology.',
      status: 'Published',
      created_at: '2026-09-20 09:00:00',
      updated_at: '2026-09-20 09:00:00',
    },
    {
      id: 4,
      title: 'Designing Scalable Relational Database Schemas',
      content:
        'Relational databases remain the backbone of mission-critical business applications. Proper normalization, defensive indexing on query filters, and strict validation layers ensure high throughput and data integrity as user traffic scales. Understanding transactional boundaries and query performance profiling prevents expensive system bottlenecks.',
      tags: 'Technology, Web Development',
      conclusion:
        'A well-architected relational model pays compounding dividends throughout the entire product lifecycle.',
      status: 'Published',
      created_at: '2026-09-22 16:45:00',
      updated_at: '2026-09-22 16:45:00',
    },
    {
      id: 5,
      title: 'Upcoming Platform Upgrades: Internal Architecture Notes',
      content:
        'This is an internal draft outlining the roadmap for Utsanova blog system enhancements, including scheduled publishing pipelines and granular role-based permissions.',
      tags: 'Technology, Career',
      conclusion:
        'Review scheduled for next engineering sprint before public release.',
      status: 'Draft',
      created_at: '2026-09-24 11:20:00',
      updated_at: '2026-09-24 11:20:00',
    },
  ],
  nextBlogId: 6,
  nextAdminId: 3,
};

const getFallbackData = () => {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading fallback storage file, resetting to default:', err);
  }
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(DEFAULT_FALLBACK_STATE, null, 2), 'utf-8');
  return JSON.parse(JSON.stringify(DEFAULT_FALLBACK_STATE));
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
    let result = data.blogs.filter((b) => b.status === 'Published');

    if (/tags\s+LIKE\s+\?/i.test(trimmed)) {
      const tagParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
      if (tagParam) {
        const cleanTag = tagParam.replace(/^%|%$/g, '').toLowerCase();
        result = result.filter((b) => b.tags.toLowerCase().includes(cleanTag));
      }
    }

    if (/(title\s+LIKE\s+\?|content\s+LIKE\s+\?)/i.test(trimmed)) {
      const searchParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
      if (searchParam) {
        const term = searchParam.replace(/^%|%$/g, '').toLowerCase();
        result = result.filter(
          (b) =>
            b.title.toLowerCase().includes(term) ||
            b.content.toLowerCase().includes(term) ||
            b.tags.toLowerCase().includes(term)
        );
      }
    }

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
    let result = data.blogs.filter((b) => b.status === 'Published');

    // Tag filter
    if (/tags\s+LIKE\s+\?/i.test(trimmed)) {
      // Find param matching '%tag%'
      const tagParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
      if (tagParam) {
        const cleanTag = tagParam.replace(/^%|%$/g, '').toLowerCase();
        result = result.filter((b) => b.tags.toLowerCase().includes(cleanTag));
      }
    }

    // Search filter across title, content, tags
    if (/(title\s+LIKE\s+\?|content\s+LIKE\s+\?)/i.test(trimmed)) {
      const searchParam = params.find((p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'));
      if (searchParam) {
        const term = searchParam.replace(/^%|%$/g, '').toLowerCase();
        result = result.filter(
          (b) =>
            b.title.toLowerCase().includes(term) ||
            b.content.toLowerCase().includes(term) ||
            b.tags.toLowerCase().includes(term)
        );
      }
    }

    // Sort by created_at DESC
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
    const [title, content, tags, conclusion, status] = params;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newBlog = {
      id: data.nextBlogId++,
      title,
      content,
      tags,
      conclusion,
      status: status || 'Draft',
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
    // If updating full fields: [title, content, tags, conclusion, status, id]
    if (params.length >= 6) {
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
    const affected = initialLength - data.blogs.length;
    saveFallbackData(data);
    return [{ affectedRows: affected }];
  }

  return [[]];
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
  getDBStatus,
};
