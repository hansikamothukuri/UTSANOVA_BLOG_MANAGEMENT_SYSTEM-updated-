import React from 'react';
import { BookOpen, SearchX, PlusCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const EmptyState = ({
  icon: Icon = BookOpen,
  title = 'No blogs found',
  description = 'There are no published blogs available at this moment.',
  actionText,
  actionLink,
  onAction,
}) => {
  return (
    <div className="text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-200">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 mb-4">
        <Icon className="w-7 h-7" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">{description}</p>

      {actionText && actionLink && (
        <Link
          to={actionLink}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          {actionText}
        </Link>
      )}

      {actionText && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors shadow-xs"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
