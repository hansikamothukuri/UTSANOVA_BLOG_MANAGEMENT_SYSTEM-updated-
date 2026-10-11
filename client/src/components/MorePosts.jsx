import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Flame, Clock, Link2 } from 'lucide-react';
import blogService from '../services/blogService.js';
import BlogCard from './BlogCard.jsx';
import { formatDate } from '../utils/formatDate.js';

const COMPACT_LIMIT = 3;

// Small ranked list used for "Popular" and "Recent" posts (the full BlogCard is used for Related)
const PostList = ({ title, icon: Icon, posts, showViews }) => {
  if (posts.length === 0) return null;
  return (
    <section className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
      <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wide mb-4">
        <Icon className="w-4 h-4 text-indigo-600" />
        {title}
      </h3>
      <ol className="space-y-3">
        {posts.map((post) => (
          <li key={post.blog_id}>
            <Link
              to={`/blogs/${post.blog_id}`}
              className="block text-sm font-semibold text-slate-800 hover:text-indigo-600 transition-colors line-clamp-2"
            >
              {post.title}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span>{formatDate(post.created_at)}</span>
              {showViews && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {(post.views ?? 0).toLocaleString()} {(post.views ?? 0) === 1 ? 'view' : 'views'}
                  </span>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

/**
 * Related / Popular / Recent posts for the blog detail page.
 * - Related: published blogs sharing a tag (GET /blogs/:id/related)
 * - Popular / Recent: the existing list endpoint (sorted + limited in the database), with the
 *   current blog filtered out. Failures are non-critical: a failed section simply stays empty.
 */
export const MorePosts = ({ blogId }) => {
  const [related, setRelated] = useState([]);
  const [popular, setPopular] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blogId) return undefined;
    let cancelled = false;
    setLoading(true);
    setRelated([]);
    setPopular([]);
    setRecent([]);

    // One extra row is requested so there are still COMPACT_LIMIT posts after removing this blog
    const notCurrent = (b) => b.blog_id !== blogId;
    Promise.allSettled([
      blogService.getRelatedBlogs(blogId, 3),
      blogService.getPublishedBlogs({ sort: 'popular', limit: COMPACT_LIMIT + 1 }),
      blogService.getPublishedBlogs({ sort: 'latest', limit: COMPACT_LIMIT + 1 }),
    ]).then(([rel, pop, rec]) => {
      if (cancelled) return;
      if (rel.status === 'fulfilled') setRelated((rel.value?.blogs || []).filter(notCurrent));
      else console.warn('Could not load related posts:', rel.reason?.message || rel.reason);
      if (pop.status === 'fulfilled') setPopular((pop.value?.blogs || []).filter(notCurrent).slice(0, COMPACT_LIMIT));
      else console.warn('Could not load popular posts:', pop.reason?.message || pop.reason);
      if (rec.status === 'fulfilled') setRecent((rec.value?.blogs || []).filter(notCurrent).slice(0, COMPACT_LIMIT));
      else console.warn('Could not load recent posts:', rec.reason?.message || rec.reason);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [blogId]);

  if (loading) return null;

  return (
    <div className="mt-12 space-y-10">
      <section aria-labelledby="related-heading">
        <h2 id="related-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-5">
          <Link2 className="w-5 h-5 text-indigo-600" />
          Related Posts
        </h2>
        {related.length === 0 ? (
          <p className="text-sm text-slate-500">No related posts yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {related.map((post) => (
              <BlogCard key={post.blog_id} blog={post} />
            ))}
          </div>
        )}
      </section>

      {(popular.length > 0 || recent.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PostList title="Popular Posts" icon={Flame} posts={popular} showViews />
          <PostList title="Recent Posts" icon={Clock} posts={recent} />
        </div>
      )}
    </div>
  );
};

export default MorePosts;
