/** Run from the project root: node --test client/tests/ist-time.test.mjs */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { istInputToUtcIso, utcIsoToIstInput, nowIstInput, formatIst } from '../src/utils/istTime.js';

describe('IST helpers', () => {
  it('10:00 IST on 15 Oct 2026 is 04:30 UTC', () => {
    assert.equal(istInputToUtcIso('2026-10-15T10:00'), '2026-10-15T04:30:00.000Z');
  });
  it('round-trips and crosses midnight correctly', () => {
    assert.equal(utcIsoToIstInput('2026-10-15T04:30:00.000Z'), '2026-10-15T10:00');
    assert.equal(istInputToUtcIso('2026-10-16T01:00'), '2026-10-15T19:30:00.000Z');
    assert.equal(utcIsoToIstInput('2026-10-15T19:30:00.000Z'), '2026-10-16T01:00');
  });
  it('rejects invalid input', () => {
    assert.equal(istInputToUtcIso(''), '');
    assert.equal(istInputToUtcIso('not a date'), '');
    assert.equal(utcIsoToIstInput('nope'), '');
  });
  it('formats in IST regardless of the machine time zone', () => {
    assert.match(formatIst('2026-10-15T04:30:00.000Z'), /15 Oct 2026.*10:00.*IST/i);
    assert.equal(nowIstInput(new Date('2026-10-15T04:30:00Z')), '2026-10-15T10:00');
  });
});
