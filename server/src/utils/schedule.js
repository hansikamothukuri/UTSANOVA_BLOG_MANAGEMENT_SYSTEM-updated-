/**
 * Scheduling time helpers (pure). Policy:
 *  - the database stores scheduled_at as a naive DATETIME that always means UTC;
 *  - the API returns it as an ISO-8601 UTC string ("2026-10-15T04:30:00.000Z");
 *  - users type/see Asia/Kolkata (IST = UTC+05:30, no DST) in the UI.
 */
export const IST_OFFSET_MINUTES = 330;

const DATE_TIME_RE =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Parses a requested publication time. Accepts ISO-8601 date-times:
 *   "2026-10-15T10:00"        -> no zone given => Asia/Kolkata wall time
 *   "2026-10-15T10:00+05:30"  -> explicit offset
 *   "2026-10-15T04:30:00Z"    -> UTC
 * The time must be strictly in the future. Returns { value: Date (UTC instant), error }.
 */
export const parseScheduledAt = (input, { now = new Date() } = {}) => {
  if (typeof input !== 'string' || input.trim() === '') {
    return { value: null, error: 'A scheduled publication date and time is required for Scheduled blogs' };
  }
  const m = DATE_TIME_RE.exec(input.trim());
  if (!m) {
    return { value: null, error: 'Invalid scheduled date/time. Use ISO 8601, e.g. 2026-10-15T10:00 (IST) or 2026-10-15T04:30:00Z' };
  }
  const [, y, mo, d, h, mi, s = '0', zone] = m;
  const [Y, M, D, H, MI, S] = [y, mo, d, h, mi, s].map(Number);
  if (M < 1 || M > 12 || D < 1 || D > 31 || H > 23 || MI > 59 || S > 59) {
    return { value: null, error: 'Invalid scheduled date/time (out-of-range component)' };
  }
  const probe = new Date(Date.UTC(Y, M - 1, D, H, MI, S));
  if (probe.getUTCFullYear() !== Y || probe.getUTCMonth() !== M - 1 || probe.getUTCDate() !== D) {
    return { value: null, error: 'Invalid scheduled date (that calendar day does not exist)' };
  }

  let offsetMinutes = IST_OFFSET_MINUTES;
  if (zone) {
    if (zone.toUpperCase() === 'Z') {
      offsetMinutes = 0;
    } else {
      const sign = zone[0] === '-' ? -1 : 1;
      const digits = zone.slice(1).replace(':', '');
      const oh = Number(digits.slice(0, 2));
      const om = Number(digits.slice(2, 4));
      if (oh > 14 || om > 59) return { value: null, error: 'Invalid time zone offset in scheduled date/time' };
      offsetMinutes = sign * (oh * 60 + om);
    }
  }

  const value = new Date(probe.getTime() - offsetMinutes * 60000);
  if (value.getTime() <= now.getTime()) {
    return { value: null, error: 'The scheduled publication time must be in the future' };
  }
  return { value, error: null };
};

/** Date -> 'YYYY-MM-DD HH:MM:SS' (UTC), the format stored in the DATETIME column. */
export const toMysqlUtc = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

/**
 * DB value -> ISO-8601 UTC string (or null).
 *  - string 'YYYY-MM-DD HH:MM:SS' (fallback store / dateStrings) is UTC by convention;
 *  - Date from mysql2 (connection timezone 'local') carries the stored wall-clock numbers in its LOCAL
 *    fields, so reading the local fields as UTC round-trips correctly on any server time zone.
 */
export const toUtcIso = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), value.getHours(), value.getMinutes(), value.getSeconds())
    ).toISOString();
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(String(value));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString();
};
