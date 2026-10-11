/**
 * Regression tests: public blog list filters (search, tag, search + tag), sort orders and
 * pagination, executed through blogService against the LOCAL JSON FALLBACK database.
 *
 * Run from the project root (Node 18+, no extra dependencies):
 *   node --test server/tests/fallback-list-filters.test.mjs
 *
 * Safety: the test forces the fallback (DATABASE_* removed) and switches the working directory
 * to a temporary folder BEFORE loading the app code, because the fallback stores its data in
 * <cwd>/utsanova_blog_data.json. Your real utsanova_blog_data.json is never read or written, and
 * no MySQL connection is made. The temp folder is deleted afterwards.
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalCwd = process.cwd();
let tmpDir;
let svc;
let everything;
const fx = {}; // fixture blogs by letter

const L = (s) => String(s || '').toLowerCase();
const matchTag = (b, t) => !t || L(b.tags).includes(L(t));
const matchQ = (b, q) => !q || [b.title, b.content, b.tags].some((f) => L(f).includes(L(q)));
const byDate = (a, b) => new Date(a.created_at) - new Date(b.created_at);
const cmp = {
  latest: (a, b) => byDate(b, a) || Number(b.blog_id) - Number(a.blog_id),
  oldest: (a, b) => byDate(a, b) || Number(a.blog_id) - Number(b.blog_id),
  popular: (a, b) => (b.views || 0) - (a.views || 0) || byDate(b, a) || Number(b.blog_id) - Number(a.blog_id),
};
// Independent brute-force model: published only, tag AND search, then sort
const expected = (q, t, sort) =>
  everything
    .filter((b) => b.status === 'Published' && matchTag(b, t) && matchQ(b, q))
    .sort(cmp[sort])
    .map((b) => b.blog_id);
const ids = (r) => r.blogs.map((b) => b.blog_id);
const list = (search, tag, sort = 'latest', extra = {}) =>
  svc.getPublishedBlogs({ search, tag, sort, limit: 100, ...extra });
const idsOf = (...blogs) => blogs.map((b) => b.blog_id).sort();

before(async () => {
  for (const k of Object.keys(process.env)) if (k.startsWith('DATABASE_')) delete process.env[k];
  delete process.env.VERCEL;
  process.env.NODE_ENV = 'test';
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'utsanova-fallback-test-'));
  process.chdir(tmpDir);
  ({ blogService: svc } = await import('../src/services/blogService.js'));

  const mk = (title, content, tags, status = 'Published') =>
    svc.createBlog({ title, content, tags, conclusion: 'c', status });

  // Fixtures: search-only and tag-only result sets deliberately differ
  fx.A = await mk('Alpha hooks', 'about state', 'React, Web');
  fx.B = await mk('Beta', 'hooks deep dive', 'React');
  fx.C = await mk('Gamma hooks', 'resume tips', 'Career');
  fx.D = await mk('Delta', 'nothing', 'Web');
  fx.E = await mk('Epsilon', 'hooks again', 'React, Career');
  fx.F = await mk('Phi', 'plain', 'Career, careerzone'); // matches "careerzone" only via tags
  fx.X = await mk('Draft hooks', 'hooks', 'React', 'Draft'); // must never appear
  // Pagination set: 7 x (React + "Zeta"), plus decoys that match only one filter
  fx.zr = [];
  for (let i = 1; i <= 7; i++) fx.zr.push(await mk(`Zeta react ${i}`, 'body', `React, T${i}`));
  for (let i = 1; i <= 4; i++) await mk(`Zeta career ${i}`, 'body', 'Career');
  for (let i = 1; i <= 3; i++) await mk(`Plain react ${i}`, 'body', 'React');
  // Distinct view counts (with a tie) so the popular order is meaningful
  const bump = async (b, n) => { for (let i = 0; i < n; i++) await svc.incrementViews(b.blog_id); };
  await bump(fx.zr[2], 5); await bump(fx.zr[5], 5); await bump(fx.zr[0], 2); await bump(fx.A, 4); await bump(fx.E, 1);

  everything = (await svc.getPublishedBlogs({ limit: 100 })).blogs;
});

after(() => {
  process.chdir(originalCwd);
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('search only', () => {
  it('matches title or content, independent of tags', async () => {
    const r = await list('hooks', '');
    assert.deepEqual(ids(r).sort(), idsOf(fx.A, fx.B, fx.C, fx.E));
    assert.equal(r.pagination.totalBlogs, 4);
  });
  it('also matches tags', async () => {
    assert.deepEqual(ids(await list('careerzone', '')), [fx.F.blog_id]);
  });
  it('returns nothing (and count 0) when nothing matches', async () => {
    const r = await list('nonexistent-term-xyz', '');
    assert.equal(r.blogs.length, 0);
    assert.equal(r.pagination.totalBlogs, 0);
  });
});

describe('tag only', () => {
  it('matches the reference model and count', async () => {
    const r = await list('', 'Career');
    assert.deepEqual(ids(r), expected('', 'Career', 'latest'));
    assert.equal(r.pagination.totalBlogs, ids(r).length);
    for (const b of [fx.C, fx.E, fx.F]) assert.ok(ids(r).includes(b.blog_id));
    for (const b of [fx.A, fx.D]) assert.ok(!ids(r).includes(b.blog_id));
  });
});

describe('search + tag together (AND)', () => {
  it('"hooks" + Career -> only C and E; count reflects both filters', async () => {
    const r = await list('hooks', 'Career');
    assert.deepEqual(ids(r).sort(), idsOf(fx.C, fx.E));
    assert.equal(r.pagination.totalBlogs, 2);
  });
  it('"hooks" + React -> A, B, E', async () => {
    assert.deepEqual(ids(await list('hooks', 'React')).sort(), idsOf(fx.A, fx.B, fx.E));
  });
  it('a search that matches only a non-React blog + tag React -> empty', async () => {
    const r = await list('careerzone', 'React');
    assert.equal(r.blogs.length, 0);
    assert.equal(r.pagination.totalBlogs, 0);
  });
  it('"zeta" + React excludes the Career decoys', async () => {
    const r = await list('zeta', 'React');
    assert.equal(r.blogs.length, 7);
    assert.equal(r.pagination.totalBlogs, 7);
  });
  it('never includes drafts', async () => {
    for (const [q, t] of [['hooks', ''], ['', 'React'], ['hooks', 'React']]) {
      assert.ok(!ids(await list(q, t)).includes(fx.X.blog_id));
    }
  });
});

describe('search + tag with every sort order', () => {
  const combos = [['hooks', 'Career'], ['hooks', 'React'], ['zeta', 'React'], ['', 'Career'], ['hooks', '']];
  for (const sort of ['latest', 'oldest', 'popular']) {
    for (const [q, t] of combos) {
      it(`sort=${sort} search="${q}" tag="${t}"`, async () => {
        assert.deepEqual(ids(await list(q, t, sort)), expected(q, t, sort));
      });
    }
  }
  it('popular ranks by views then newest (views 5,5,2,0...)', async () => {
    const r = (await list('zeta', 'React', 'popular')).blogs;
    assert.deepEqual(r.map((b) => b.views), [5, 5, 2, 0, 0, 0, 0]);
    assert.ok(new Date(r[0].created_at) >= new Date(r[1].created_at));
  });
});

describe('pagination with combined filters (limit 3)', () => {
  for (const sort of ['latest', 'oldest', 'popular']) {
    it(`sort=${sort}: 7 results over 3 pages, no gaps or duplicates`, async () => {
      const want = expected('zeta', 'React', sort);
      const got = [];
      let totalPages = 0;
      for (let page = 1; page <= 3; page++) {
        const r = await svc.getPublishedBlogs({ search: 'zeta', tag: 'React', sort, page, limit: 3 });
        totalPages = r.pagination.totalPages;
        assert.equal(r.pagination.totalBlogs, 7);
        assert.equal(r.blogs.length, page < 3 ? 3 : 1);
        got.push(...ids(r));
      }
      assert.equal(totalPages, 3);
      assert.deepEqual(got, want);
      assert.equal(new Set(got).size, got.length);
      const beyond = await svc.getPublishedBlogs({ search: 'zeta', tag: 'React', sort, page: 9, limit: 3 });
      assert.equal(beyond.blogs.length, 0);
      assert.equal(beyond.pagination.totalBlogs, 7);
    });
  }
});
