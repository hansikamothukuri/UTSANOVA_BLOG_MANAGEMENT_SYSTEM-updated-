import React, { useMemo } from 'react';
import { getTextStats } from '../utils/textStats.js';

const formatNumber = (n) => n.toLocaleString('en-US');

/**
 * Live "N characters · N words" readout for a text field. It is derived from the field's
 * current value during render, so it updates on every keystroke, paste and deletion.
 *
 * `max` (optional) shows "N / max" and turns red when the validator's limit is exceeded; the
 * limit is checked the same way the form/server validators do (trimmed .length).
 * Pass `id` and reference it from the field's aria-describedby. It is deliberately not an
 * aria-live region, so screen readers are not interrupted on every keystroke.
 */
export const TextCounter = ({ value = '', max, id, className = '' }) => {
  const stats = useMemo(() => getTextStats(value), [value]);
  const overLimit = typeof max === 'number' && value.trim().length > max;

  return (
    <p
      id={id}
      data-testid={id}
      className={`flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums ${
        overLimit ? 'text-red-600 font-semibold' : 'text-slate-500'
      } ${className}`}
    >
      <span>
        {formatNumber(stats.characters)}
        {typeof max === 'number' ? ` / ${formatNumber(max)}` : ''}{' '}
        {stats.characters === 1 ? 'character' : 'characters'}
      </span>{' '}
      <span aria-hidden="true">·</span>{' '}
      <span>
        {formatNumber(stats.words)} {stats.words === 1 ? 'word' : 'words'}
      </span>
    </p>
  );
};

export default TextCounter;
