import React from 'react';

export const TagBadge = ({ tag, onClick, active = false, size = 'sm' }) => {
  const isClickable = !!onClick;

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2.5 py-1 text-xs font-medium',
    md: 'px-3 py-1.5 text-sm font-medium',
  };

  const activeClasses = active
    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100/80';

  const nonClickableClasses = 'bg-slate-100 text-slate-700 border border-slate-200/60';

  return (
    <span
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`inline-flex items-center rounded-md transition-colors duration-150 ${sizeClasses[size] || sizeClasses.sm} ${
        isClickable ? activeClasses : nonClickableClasses
      } ${isClickable ? 'cursor-pointer select-none' : ''}`}
    >
      #{tag.trim()}
    </span>
  );
};

export default TagBadge;
