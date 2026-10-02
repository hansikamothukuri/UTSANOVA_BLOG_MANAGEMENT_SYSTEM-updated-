import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Pagination controls used on the public blog listing.
 * Purely presentational — the parent owns the current page state and
 * is responsible for re-fetching data when the page changes.
 */
export const Pagination = ({ currentPage = 1, totalPages = 0, onPageChange }) => {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;

  const handlePrevious = () => {
    if (!isFirstPage) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (!isLastPage) onPageChange(currentPage + 1);
  };

  // Builds a compact page-number list with ellipses for large page counts
  const getPageNumbers = () => {
    const pages = [];
    const delta = 1;

    const rangeStart = Math.max(2, currentPage - delta);
    const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

    pages.push(1);
    if (rangeStart > 2) pages.push('ellipsis-start');
    for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);
    if (rangeEnd < totalPages - 1) pages.push('ellipsis-end');
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <nav
      className="flex items-center justify-center gap-1.5 mt-10"
      aria-label="Blog list pagination"
    >
      <button
        type="button"
        onClick={handlePrevious}
        disabled={isFirstPage}
        className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
          isFirstPage
            ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-white'
            : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100'
        }`}
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        Previous
      </button>

      {getPageNumbers().map((page, idx) =>
        typeof page === 'number' ? (
          <button
            key={page}
            type="button"
            onClick={() => page !== currentPage && onPageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
            className={`min-w-[2.25rem] px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
              page === currentPage
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100'
            }`}
          >
            {page}
          </button>
        ) : (
          <span key={`${page}-${idx}`} className="px-1.5 text-xs text-slate-400">
            &hellip;
          </span>
        )
      )}

      <button
        type="button"
        onClick={handleNext}
        disabled={isLastPage}
        className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors ${
          isLastPage
            ? 'border-slate-200 text-slate-300 cursor-not-allowed bg-white'
            : 'border-slate-200 text-slate-700 bg-white hover:bg-slate-100'
        }`}
      >
        Next
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </nav>
  );
};

export default Pagination;
