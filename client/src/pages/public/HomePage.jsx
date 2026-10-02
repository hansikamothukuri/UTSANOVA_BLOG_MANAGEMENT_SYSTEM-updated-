import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  Sparkles,
  TrendingUp,
  Award,
  Layers,
  Search,
} from 'lucide-react';
import blogService from '../../services/blogService.js';
import BlogCard from '../../components/BlogCard.jsx';
import TagBadge from '../../components/TagBadge.jsx';
import { BlogCardSkeleton } from '../../components/LoadingSpinner.jsx';

export const HomePage = () => {
  const [recentBlogs, setRecentBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const popularTags = [
    'Technology',
    'Education',
    'Career',
    'Students',
    'React',
    'Web Development',
  ];

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        setLoading(true);
        const data = await blogService.getPublishedBlogs({ page: 1, limit: 3 });
        // Take top 3 published blogs for the homepage
        setRecentBlogs(data.blogs.slice(0, 3));
      } catch (err) {
        console.error('Failed to load homepage blogs:', err);
        setError('Unable to load latest articles.');
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  return (
    <div>
      {/* Hero Section - Matching SRS Reference Diagram */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-900 to-slate-950 text-white py-20 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Official Utsanova Engineering & Tech Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-white mb-6">
              Latest Insights <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-violet-300 to-cyan-300">
                and Ideas.
              </span>
            </h1>

            <p className="text-lg text-slate-300 leading-relaxed mb-8 max-w-2xl">
              Explore in-depth engineering breakdowns, educational methodologies, modern development workflows, and career acceleration strategies curated by Utsanova Technologies.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/blogs"
                className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2"
              >
                Read Published Blogs
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                to="/admin/login"
                className="px-6 py-3.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-semibold text-sm rounded-xl border border-slate-700 transition-all"
              >
                Admin Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Topics / Tags Pill Bar */}
      <section className="bg-white border-b border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <span>Trending Topics:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {popularTags.map((tag) => (
              <Link key={tag} to={`/blogs?tag=${encodeURIComponent(tag)}`}>
                <TagBadge tag={tag} size="sm" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured / Recent Blogs Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
              Curated Articles
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Latest Published Blogs
            </h2>
          </div>

          <Link
            to="/blogs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            View All ({recentBlogs.length > 0 ? `${recentBlogs.length}+` : 'Browse'})
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <BlogCardSkeleton />
            <BlogCardSkeleton />
            <BlogCardSkeleton />
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-700 rounded-xl text-center border border-red-200">
            {error}
          </div>
        ) : recentBlogs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-600 text-sm">No published blogs found yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentBlogs.map((blog) => (
              <BlogCard key={blog.id} blog={blog} />
            ))}
          </div>
        )}
      </section>

      {/* Engineering Pillars Grid */}
      <section className="bg-slate-100/70 border-t border-slate-200 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
              The Utsanova Knowledge Hub
            </h2>
            <p className="text-sm text-slate-600">
              Structured to support practical learning, transparent technical documentation, and real engineering growth.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Full-Stack Architecture</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Step-by-step breakdowns of relational schema design, API security, and production frontend engineering.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Industry Preparedness</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Practical guides for engineering students and interns navigating tech interviews, portfolios, and real codebase contributions.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Verified Production Standards</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Parameterized queries, Firebase token verification, role-based admin authorization, and zero mock fallbacks.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
