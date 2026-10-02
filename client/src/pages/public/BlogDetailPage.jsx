import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Tag,
  BookOpen,
} from 'lucide-react';
import blogService from '../../services/blogService.js';
import TagBadge from '../../components/TagBadge.jsx';
import { LoadingSpinner } from '../../components/LoadingSpinner.jsx';
import { formatDate, calculateReadTime } from '../../utils/formatDate.js';
import MarkdownRenderer from '../../components/MarkdownRenderer.jsx';

export const BlogDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await blogService.getPublishedBlogById(id);
        if (!data) {
          setError('Blog not found or is currently in draft status.');
        } else {
          setBlog(data);
        }
      } catch (err) {
        console.error('Failed to load blog detail:', err);
        setError(err.message || 'Article not found or not published yet.');
      } finally {
        setLoading(false);
      }
    };

    fetchBlog();
  }, [id]);

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <LoadingSpinner message="Loading article..." />
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Article Not Found</h2>
          <p className="text-slate-600 text-sm mb-6">
            {error || 'This article does not exist or has not been published yet.'}
          </p>
          <Link
            to="/blogs"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-colors shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to All Blogs
          </Link>
        </div>
      </div>
    );
  }

  const tagsList = blog.tags
    ? blog.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
      {/* Back button */}
      <div className="mb-8">
        <Link
          to="/blogs"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all blogs
        </Link>
      </div>

      {/* Article Header */}
      <header className="mb-8 border-b border-slate-200/80 pb-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-4">
          <span className="flex items-center gap-1.5 font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            {formatDate(blog.created_at)}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <Clock className="w-3.5 h-3.5" />
            {calculateReadTime(blog.content)}
          </span>
          <span>•</span>
          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold text-[11px]">
            Published
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-6">
          {blog.title}
        </h1>

        {/* Action Bar */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-700 to-violet-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              U
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Utsanova Editorial</p>
              <p className="text-[11px] text-slate-500">Official Publication</p>
            </div>
          </div>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            title="Share article link"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Body - Rendered from Markdown */}
      <div className="max-w-none mb-12">
        <MarkdownRenderer content={blog.content} />
      </div>

      {/* Conclusion Section - Exact SRS Requirement */}
      {blog.conclusion && (
        <section className="my-10 p-6 sm:p-7 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-violet-50/50 to-white border border-indigo-100/90 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
              ✓
            </div>
            <h3 className="text-base font-bold text-indigo-950 uppercase tracking-wide">
              Key Takeaway & Conclusion
            </h3>
          </div>
          <p className="text-slate-700 text-sm sm:text-base leading-relaxed pl-8">
            {blog.conclusion}
          </p>
        </section>
      )}

      {/* Tags / Keywords Section */}
      <footer className="pt-6 border-t border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 mr-1">
            <Tag className="w-3.5 h-3.5" />
            Article Tags:
          </span>
          {tagsList.map((tag, idx) => (
            <TagBadge
              key={idx}
              tag={tag}
              size="md"
              onClick={() => navigate(`/blogs?tag=${encodeURIComponent(tag)}`)}
            />
          ))}
        </div>
      </footer>
    </article>
  );
};

export default BlogDetailPage;
