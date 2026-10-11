/**
 * Tests for the reading-progress maths (client/src/utils/readingProgress.js).
 * Run from the project root (Node 18+):  node --test client/tests/*.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeReadingProgress, clamp01 } from '../src/utils/readingProgress.js';

const VH = 800;
// Long article: starts 400px down the page, 4000px tall -> bottom at 4400.
const long = { contentTop: 400, contentHeight: 4000, viewportHeight: VH, maxScroll: 6000 };
// Short article: starts 400px down, only 300px tall.
const short = { contentTop: 400, contentHeight: 300, viewportHeight: VH, maxScroll: 2000 };
const p = (base, scrollY, extra = {}) => computeReadingProgress({ ...base, scrollY, ...extra });

describe('long article', () => {
  it('is 0% at the top of the page and until the article reaches the top of the viewport', () => {
    assert.equal(p(long, 0), 0);
    assert.equal(p(long, 399), 0);
    assert.equal(p(long, 400), 0);
  });
  it('is 50% in the middle of the scrollable range', () => {
    // range = 400 .. (4400 - 800) = 400 .. 3600  -> midpoint 2000
    assert.equal(p(long, 2000), 0.5);
  });
  it('reaches 100% when the end of the article reaches the bottom of the viewport', () => {
    assert.equal(p(long, 3600), 1);
  });
  it('never exceeds 100% or goes below 0% (overscroll / negative scroll)', () => {
    assert.equal(p(long, 99999), 1);
    assert.equal(p(long, -500), 0);
  });
  it('increases monotonically while scrolling', () => {
    let prev = -1;
    for (let y = 0; y <= 6000; y += 50) {
      const v = p(long, y);
      assert.ok(v >= prev && v >= 0 && v <= 1);
      prev = v;
    }
  });
  it('caps the end point at the maximum scroll position so 100% is reachable', () => {
    const nearEnd = { ...long, maxScroll: 3000 }; // page cannot scroll as far as 3600
    assert.equal(p(nearEnd, 3000), 1);
  });
});

describe('short article (fits in one viewport)', () => {
  it('is 0% at the top, even though the whole article is already visible', () => {
    assert.equal(p(short, 0), 0);
  });
  it('reaches 100% once the article end is in the upper quarter of the viewport', () => {
    // end = 700 - 800*0.25 = 500
    assert.equal(p(short, 500), 1);
    assert.equal(p(short, 250), 0.5);
  });
  it('stays within 0..1', () => {
    for (let y = -100; y <= 3000; y += 25) {
      const v = p(short, y);
      assert.ok(v >= 0 && v <= 1);
    }
  });
});

describe('edge cases', () => {
  it('returns 0 for missing / zero sizes', () => {
    assert.equal(p({ ...long, contentHeight: 0 }, 1000), 0);
    assert.equal(p({ ...long, viewportHeight: 0 }, 1000), 0);
    assert.equal(p({ ...long, contentHeight: NaN }, 1000), 0);
  });
  it('is 0 (not 100%) on a page that cannot scroll at all', () => {
    assert.equal(p({ ...short, maxScroll: 0 }, 0), 0);
  });
  it('is 100% after scrolling when the article is shorter than the reading line distance', () => {
    assert.equal(p({ contentTop: 0, contentHeight: 100, viewportHeight: VH, maxScroll: 50 }, 50), 1);
  });
  it('handles a mobile-sized viewport', () => {
    const m = { contentTop: 500, contentHeight: 5000, viewportHeight: 667, maxScroll: 7000 };
    assert.equal(p(m, 0), 0);
    assert.equal(p(m, 500 + (5000 - 667) / 2), 0.5);
    assert.equal(p(m, 5500 - 667), 1);
  });
  it('clamp01 treats non-finite values as 0', () => {
    assert.equal(clamp01(NaN), 0);
    assert.equal(clamp01(Infinity), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01(-1), 0);
  });
});
