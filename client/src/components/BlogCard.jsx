import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import TagBadge from './TagBadge.jsx';
import { formatDate, getExcerpt, calculateReadTime } from '../utils/formatDate.js';

export const BlogCard = ({ blog, onTagClick }) => {
  const tagsList = blog.tags
    ? blog.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <article className="group bg-white rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
      <div className="p-6">
        {/* Meta Header */}
        <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
          <span className="flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            {formatDate(blog.created_at)}
          </span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            {calculateReadTime(blog.content)}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors duration-150 line-clamp-2 mb-3">
          <Link to={`/blogs/${blog.id}`}>{blog.title}</Link>
        </h3>

        {/* Excerpt */}
        <p className="text-slate-600 text-sm leading-relaxed line-clamp-3 mb-4">
          {getExcerpt(blog.content, 160)}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tagsList.map((tag, idx) => (
            <TagBadge
              key={idx}
              tag={tag}
              onClick={onTagClick ? () => onTagClick(tag) : undefined}
            />
          ))}
        </div>
      </div>

      {/* Footer / Read More Button */}
      <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
        <Link
          to={`/blogs/${blog.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700 transition-colors group-hover:translate-x-0.5 duration-150"
        >
          Read Full Article
          <ArrowRight className="w-4 h-4" />
        </Link>
        <span className="text-xs text-slate-400 font-mono">#{blog.id}</span>
      </div>
    </article>
  );
};

export default BlogCard;
