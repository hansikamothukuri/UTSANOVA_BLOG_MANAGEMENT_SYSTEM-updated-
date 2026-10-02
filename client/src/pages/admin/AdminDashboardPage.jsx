import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  CheckCircle,
  Clock,
  PlusCircle,
  ArrowRight,
  Database,
  ExternalLink,
  Edit,
  Eye,
  RefreshCw,
} from 'lucide-react';
import blogService from '../../services/blogService.js';
import { LoadingSpinner } from '../../components/LoadingSpinner.jsx';
import { formatDate } from '../../utils/formatDate.js';
import TagBadge from '../../components/TagBadge.jsx';

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const data = await blogService.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(err.message || 'Failed to load dashboard statistics from MySQL.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return <LoadingSpinner message="Loading dashboard statistics from database..." />;
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700">
        <p className="font-bold mb-2">Error Connecting to Dashboard API</p>
        <p className="text-sm mb-4">{error}</p>
        <button
          onClick={() => fetchStats(false)}
          className="px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time analytics and management for Utsanova Blog platform.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-xs"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          <Link
            to="/admin/blogs/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Create New Blog
          </Link>
        </div>
      </div>

      {/* 3 Metric Cards - Matching SRS Reference Diagram */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {/* Total Blogs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Total Blogs
            </p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-slate-900">
              {stats?.totalBlogs ?? 0}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">In MySQL database</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Published Blogs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Published
            </p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-emerald-600">
              {stats?.publishedBlogs ?? 0}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Live & visible to visitors</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Draft Blogs */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Drafts
            </p>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-amber-500">
              {stats?.draftBlogs ?? 0}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Hidden from public view</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Database Connection Info Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-indigo-400 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">
              Database: <span className="font-mono text-indigo-600">utsanova_blog</span>
            </p>
            <p className="text-xs text-slate-500">
              Mode: {stats?.dbStatus?.storageMode || 'MySQL Pool / Relational Storage'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational
          </span>
          <Link
            to="/admin/blogs"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-3 py-1 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            Manage Blogs →
          </Link>
        </div>
      </div>

      {/* Recent Blogs Table - Matching SRS Reference Diagram (Page 1) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Blogs</h2>
            <p className="text-xs text-slate-500">Latest modified or created blog posts</p>
          </div>
          <Link
            to="/admin/blogs"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View All Blogs ({stats?.totalBlogs || 0})
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th scope="col" className="px-6 py-3.5">Blog Title</th>
                <th scope="col" className="px-6 py-3.5">Tags / Keywords</th>
                <th scope="col" className="px-6 py-3.5">Date</th>
                <th scope="col" className="px-6 py-3.5">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recentBlogs?.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-slate-500">
                    No blogs found in the database.
                  </td>
                </tr>
              ) : (
                stats?.recentBlogs?.map((blog) => (
                  <tr key={blog.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Title */}
                    <td className="px-6 py-4 font-semibold text-slate-900 max-w-xs truncate">
                      <Link
                        to={`/admin/blogs/${blog.id}/edit`}
                        className="hover:text-indigo-600 transition-colors"
                      >
                        {blog.title}
                      </Link>
                    </td>

                    {/* Tags */}
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {blog.tags
                          ?.split(',')
                          .slice(0, 2)
                          .map((t, idx) => (
                            <TagBadge key={idx} tag={t} size="xs" />
                          ))}
                        {blog.tags?.split(',').length > 2 && (
                          <span className="text-[10px] text-slate-400 self-center">
                            +{blog.tags.split(',').length - 2}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(blog.created_at)}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          blog.status === 'Published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {blog.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {blog.status === 'Published' && (
                          <Link
                            to={`/blogs/${blog.id}`}
                            target="_blank"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                            title="View Public Post"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                        )}
                        <Link
                          to={`/admin/blogs/${blog.id}/edit`}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Edit Blog"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;
