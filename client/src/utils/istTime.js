/**
 * Asia/Kolkata (IST, UTC+05:30, no daylight saving) helpers for scheduled publishing.
 * The server stores/compares UTC; the UI always shows and edits IST.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

/** <input type="datetime-local"> value ('YYYY-MM-DDTHH:mm', IST wall time) -> ISO UTC string, or '' if invalid. */
export const istInputToUtcIso = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!m) return '';
  const [Y, M, D, h, mi] = m.slice(1).map(Number);
  const ms = Date.UTC(Y, M - 1, D, h, mi) - IST_OFFSET_MS;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/** ISO UTC string -> value for <input type="datetime-local"> in IST ('' if invalid). */
export const utcIsoToIstInput = (iso) => {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return '';
  const d = new Date(t + IST_OFFSET_MS); // read with UTC getters => IST wall clock
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

/** Current time as an IST datetime-local value (used for the picker's minimum). */
export const nowIstInput = (now = new Date()) => utcIsoToIstInput(now.toISOString());

/** ISO UTC string -> '15 Oct 2026, 10:00 am IST' */
export const formatIst = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d) + ' IST'
  );
};
