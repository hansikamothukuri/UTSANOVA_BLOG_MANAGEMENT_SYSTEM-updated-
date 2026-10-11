/**
 * Tests for the editor's character / word counting (client/src/utils/textStats.js).
 * Run from the project root (Node 18+):  node --test client/tests/*.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { countCharacters, countWords, getTextStats } from '../src/utils/textStats.js';

describe('countWords', () => {
  it('is 0 for empty, undefined, null and non-string input', () => {
    for (const v of ['', undefined, null, 42, {}]) assert.equal(countWords(v), 0);
  });
  it('is 0 for whitespace-only content (spaces, tabs, newlines, NBSP)', () => {
    assert.equal(countWords('   '), 0);
    assert.equal(countWords('\n\n\n'), 0);
    assert.equal(countWords(' \t \r\n \u00a0 '), 0);
  });
  it('counts normal text', () => {
    assert.equal(countWords('hello'), 1);
    assert.equal(countWords('hello world'), 2);
    assert.equal(countWords('The quick brown fox.'), 4);
  });
  it('ignores multiple spaces and leading/trailing whitespace', () => {
    assert.equal(countWords('  hello     world   '), 2);
    assert.equal(countWords('a\t\tb'), 2);
  });
  it('handles line breaks (LF, CRLF, blank lines)', () => {
    assert.equal(countWords('one\ntwo\r\nthree\n\n\nfour'), 4);
    assert.equal(countWords('\nhello\n'), 1);
  });
  it('treats a pasted multi-paragraph block correctly', () => {
    const pasted = '# Title\n\nFirst   paragraph here.\n\n\nSecond paragraph.\n';
    assert.equal(countWords(pasted), 7); // "#" counts as a token, like calculateReadTime()
  });
  it('is a single word for hyphenated / punctuated tokens', () => {
    assert.equal(countWords('state-of-the-art, well...'), 2);
  });
  it('handles non-Latin scripts separated by spaces', () => {
    assert.equal(countWords('नमस्ते दुनिया'), 2);
  });
});

describe('countCharacters', () => {
  it('is 0 for empty / non-string input', () => {
    for (const v of ['', undefined, null, 7]) assert.equal(countCharacters(v), 0);
  });
  it('counts spaces and line breaks as characters', () => {
    assert.equal(countCharacters('a b'), 3);
    assert.equal(countCharacters('a\nb'), 3);
    assert.equal(countCharacters('   '), 3);
  });
  it('counts emoji / astral characters as one character', () => {
    assert.equal(countCharacters('😀'), 1);
    assert.equal(countCharacters('a😀b'), 3);
  });
  it('is fast on very large input', () => {
    const big = 'word '.repeat(200_000); // 1,000,000 chars
    const t = performance.now();
    assert.equal(countCharacters(big), 1_000_000);
    assert.equal(countWords(big), 200_000);
    assert.ok(performance.now() - t < 500, 'counting 1M chars should be well under 500 ms');
  });
});

describe('getTextStats', () => {
  it('returns both counts together', () => {
    assert.deepEqual(getTextStats('hi  there'), { characters: 9, words: 2 });
    assert.deepEqual(getTextStats(''), { characters: 0, words: 0 });
  });
});
