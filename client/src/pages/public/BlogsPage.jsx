import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, X, BookOpen, Layers } from 'lucide-react';
import blogService from '../../services/blogService.js';
import BlogCard from '../../components/BlogCard.jsx';
import SearchBar from '../../components/SearchBar.jsx';
import TagBadge from '../../components/TagBadge.jsx';
import { BlogCardSkeleton } from '../../components/LoadingSpinner.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import Pagination from '../../components/Pagination.jsx';

const BLOGS_PER_PAGE = 9;

export const BlogsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [blogs, setBlogs] = useState([]);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    limit: BLOGS_PER_PAGE,
    totalBlogs: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentSearch = searchParams.get('search') || '';
  const currentTag = searchParams.get('tag') || '';
  const rawPage = parseInt(searchParams.get('page'), 10);
  const currentPage = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const filterTags = [
    'All Topics',
    'Technology',
    'Education',
    'Career',
    'Students',
    'React',
    'Web Development',
  ];

  const fetchBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await blogService.getPublishedBlogs({
        search: currentSearch,
        tag: currentTag,
        page: currentPage,
        limit: BLOGS_PER_PAGE,
      });
      setBlogs(data.blogs || []);
      setPagination(
        data.pagination || {
          currentPage: 1,
          limit: BLOGS_PER_PAGE,
          totalBlogs: 0,
          totalPages: 0,
        }
      );
    } catch (err) {
      console.error('Failed to fetch blogs:', err);
      const detail = err?.message || 'Network connection issue';
      setError(`Failed to load published blogs: ${detail}. Please check connection or retry.`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSearch, currentTag, currentPage]);

  const handleSearch = (term) => {
    const params = new URLSearchParams(searchParams);
    if (term) {
      params.set('search', term);
    } else {
      params.delete('search');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleSelectTag = (tag) => {
    const params = new URLSearchParams(searchParams);
    if (tag && tag !== 'All Topics') {
      params.set('tag', tag);
    } else {
      params.delete('tag');
    }
    params.delete('page');
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchParams({});
  };

  const handlePageChange = (page) => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) {
      params.set('page', String(page));
    } else {
      params.delete('page');
    }
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const hasActiveFilters = Boolean(currentSearch || currentTag);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      {/* Header */}
      <div className="max-w-3xl mb-8">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
          Published Blogs & Insights
        </h1>
        <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
          Search and discover curated technical deep dives, industry trends, and student career resources published by the Utsanova team.
        </p>
      </div>

      {/* Search & Tag Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-xs mb-8 space-y-4">
        {/* Search Input */}
        <div className="max-w-2xl">
          <SearchBar
            onSearch={handleSearch}
            initialValue={currentSearch}
            placeholder="Search blogs by title, keywords, or content..."
          />
        </div>

        {/* Tag Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Tags:
          </span>

          {filterTags.map((tag) => {
            const isAll = tag === 'All Topics';
            const isActive = isAll ? !currentTag : currentTag.toLowerCase() === tag.toLowerCase();

            return (
              <button
                key={tag}
                type="button"
                onClick={() => handleSelectTag(isAll ? '' : tag)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                }`}
              >
                {tag}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 ml-auto font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Indicators */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mb-6 text-xs text-slate-500">
          <span>Active filter:</span>
          {currentSearch && (
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
              Keyword: "{currentSearch}"
            </span>
          )}
          {currentTag && (
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md">
              Tag: #{currentTag}
            </span>
          )}
          <span className="text-slate-400">({pagination.totalBlogs} articles found)</span>
        </div>
      )}

      {/* Blogs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <BlogCardSkeleton />
          <BlogCardSkeleton />
          <BlogCardSkeleton />
          <BlogCardSkeleton />
          <BlogCardSkeleton />
          <BlogCardSkeleton />
        </div>
      ) : error ? (
        <div className="p-8 text-center bg-red-50 border border-red-200 rounded-2xl text-red-700">
          <p className="font-semibold mb-2">Error Loading Blogs</p>
          <p className="text-sm mb-4">{error}</p>
          <button
            onClick={fetchBlogs}
            className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : blogs.length === 0 ? (
        <EmptyState
          icon={hasActiveFilters ? BookOpen : Layers}
          title={hasActiveFilters ? 'No blogs match your filter' : 'No published blogs available'}
          description={
            hasActiveFilters
              ? 'Try changing your search terms or clearing your tag filters to see more results.'
              : 'Our editorial team is crafting new content. Check back shortly!'
          }
          actionText={hasActiveFilters ? 'Clear All Filters' : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map((blog) => (
              <BlogCard
                key={blog.id}
                blog={blog}
                onTagClick={(tag) => handleSelectTag(tag)}
              />
            ))}
          </div>

          <Pagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
};

export default BlogsPage;
