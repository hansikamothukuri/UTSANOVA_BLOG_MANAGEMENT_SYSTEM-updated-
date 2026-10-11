import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Calendar,
  Clock,
  ArrowLeft,
  Share2,
  CheckCircle2,
  Tag,
  BookOpen,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Send,
} from 'lucide-react';
import blogService from '../../services/blogService.js';
import TagBadge from '../../components/TagBadge.jsx';
import { LoadingSpinner } from '../../components/LoadingSpinner.jsx';
import { formatDate, formatDateTime, calculateReadTime } from '../../utils/formatDate.js';
import MarkdownRenderer from '../../components/MarkdownRenderer.jsx';
import { useAuth } from '../../hooks/useAuth.jsx';
import MorePosts from '../../components/MorePosts.jsx';
import ReadingProgressBar from '../../components/ReadingProgressBar.jsx';

export const BlogDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const location = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Likes: persisted in the database; `liked` is for the signed-in Firebase user only.
  const [likeState, setLikeState] = useState({ like_count: 0, liked: false });
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeError, setLikeError] = useState('');
  const likeBusyRef = useRef(false); // blocks double clicks before React re-renders

  // Views: count at most once per blog per browser session (see effect below)
  const viewedRef = useRef(new Set());

  // The article body (cover image + content + conclusion): reading progress is measured over this
  const articleContentRef = useRef(null);

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

    window.scrollTo({ top: 0 });
    fetchBlog();
  }, [id]);

  // Count one view per blog per browser session. The ref guard also covers React StrictMode's
  // double-invoked effects in development; the dependency is only the blog's id, so updating
  // the view count in state cannot re-trigger it.
  const viewedBlogId = blog?.blog_id;
  useEffect(() => {
    if (!viewedBlogId || viewedRef.current.has(viewedBlogId)) return;
    viewedRef.current.add(viewedBlogId);

    const storageKey = `utsanova_viewed_${viewedBlogId}`;
    try {
      if (sessionStorage.getItem(storageKey)) return; // already counted in this session
      sessionStorage.setItem(storageKey, '1');
    } catch {
      // sessionStorage unavailable: the in-memory ref above still prevents duplicates
    }

    blogService
      .recordBlogView(viewedBlogId)
      .then((result) => {
        if (result && typeof result.views === 'number') {
          setBlog((prev) => (prev && prev.blog_id === viewedBlogId ? { ...prev, views: result.views } : prev));
        }
      })
      .catch((err) => {
        console.warn('Could not record view:', err?.message || err);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          // ignore
        }
        viewedRef.current.delete(viewedBlogId);
      });
  }, [viewedBlogId]);

  // Load like count (+ "liked by me"). Re-runs when the user signs in/out so the heart is correct.
  useEffect(() => {
    if (authLoading) return undefined;
    let cancelled = false;
    setLikeError('');
    blogService
      .getBlogLikes(id)
      .then((data) => {
        if (!cancelled && data) setLikeState({ like_count: data.like_count || 0, liked: !!data.liked });
      })
      .catch((err) => {
        console.warn('Could not load likes:', err?.message || err);
      });
    return () => {
      cancelled = true;
    };
  }, [id, isAuthenticated, authLoading]);

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      // Existing auth flow: send the visitor to the (Firebase) login page
      navigate('/admin/login', { state: { from: location } });
      return;
    }
    if (likeBusyRef.current) return;
    likeBusyRef.current = true;
    setLikeBusy(true);
    setLikeError('');
    try {
      const data = likeState.liked ? await blogService.unlikeBlog(id) : await blogService.likeBlog(id);
      setLikeState({ like_count: data.like_count || 0, liked: !!data.liked });
    } catch (err) {
      setLikeError(err?.message || 'Could not update your like. Please try again.');
    } finally {
      likeBusyRef.current = false;
      setLikeBusy(false);
    }
  };

  // Comments: public to read; posting requires a signed-in Firebase user (author comes from the token).
  const MAX_COMMENT_LENGTH = 1000;
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState('');
  const commentBusyRef = useRef(false); // blocks double submits before React re-renders

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);
    setCommentsError('');
    setComments([]);
    blogService
      .getBlogComments(id)
      .then((data) => {
        if (!cancelled) setComments(data?.comments || []);
      })
      .catch((err) => {
        if (!cancelled) setCommentsError(err?.message || 'Could not load comments.');
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (commentBusyRef.current) return;
    const content = commentText.trim();
    if (!content) {
      setCommentError('Please write a comment before posting.');
      return;
    }
    if (content.length > MAX_COMMENT_LENGTH) {
      setCommentError(`Comments can be at most ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }
    commentBusyRef.current = true;
    setCommentSubmitting(true);
    setCommentError('');
    try {
      const created = await blogService.addBlogComment(id, content);
      setCommentText('');
      try {
        // Refresh from the server so the list is authoritative (and includes other people's comments)
        const data = await blogService.getBlogComments(id);
        setComments(data?.comments || []);
        setCommentsError('');
      } catch {
        // The comment was saved; if only the refresh failed, show it locally
        if (created?.comment) setComments((prev) => [...prev, created.comment]);
      }
    } catch (err) {
      setCommentError(err?.message || 'Could not post your comment. Please try again.');
    } finally {
      commentBusyRef.current = false;
      setCommentSubmitting(false);
    }
  };

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
      <ReadingProgressBar targetRef={articleContentRef} />

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
          <span className="flex items-center gap-1.5 text-slate-600 font-medium" title="Views">
            <Eye className="w-3.5 h-3.5" />
            {(blog.views ?? 0).toLocaleString()} {(blog.views ?? 0) === 1 ? 'view' : 'views'}
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-700 to-violet-500 text-white font-bold flex items-center justify-center text-sm shadow-xs">
              U
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900">Utsanova Editorial</p>
              <p className="text-[11px] text-slate-500">Official Publication</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleLike}
            disabled={likeBusy || authLoading}
            aria-pressed={likeState.liked}
            aria-label={likeState.liked ? 'Unlike this article' : 'Like this article'}
            title={isAuthenticated ? (likeState.liked ? 'Unlike' : 'Like') : 'Sign in to like this article'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              likeState.liked
                ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {likeBusy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Heart className={`w-3.5 h-3.5 ${likeState.liked ? 'fill-rose-500 text-rose-500' : ''}`} />
            )}
            <span>{likeState.liked ? 'Liked' : 'Like'}</span>
            <span className="font-semibold tabular-nums">{likeState.like_count}</span>
          </button>

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
        </div>
        {likeError && (
          <p role="alert" className="mt-3 text-xs text-red-600">
            {likeError}
          </p>
        )}
        {!isAuthenticated && !authLoading && (
          <p className="mt-3 text-[11px] text-slate-500">
            <Link to="/admin/login" state={{ from: location }} className="font-semibold text-indigo-600 hover:underline">
              Sign in
            </Link>{' '}
            to like this article.
          </p>
        )}
      </header>

      <div ref={articleContentRef}>
      {/* Cover image (Cloudinary URL stored with the blog) */}
      {blog.image_url && (
        <img
          src={blog.image_url}
          alt={blog.title}
          className="w-full max-h-[480px] object-cover rounded-2xl border border-slate-200 mb-10"
        />
      )}

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
      </div>

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

      {/* Comments */}
      <section className="mt-12 pt-8 border-t border-slate-200" aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="flex items-center gap-2 text-lg font-bold text-slate-900 mb-5">
          <MessageCircle className="w-5 h-5 text-indigo-600" />
          Comments{!commentsLoading && !commentsError ? ` (${comments.length})` : ''}
        </h2>

        {/* Form (signed-in users) or sign-in prompt (visitors) */}
        {authLoading ? null : isAuthenticated ? (
          <form onSubmit={handleSubmitComment} className="mb-8" noValidate>
            <label htmlFor="comment-input" className="sr-only">
              Add a comment
            </label>
            <textarea
              id="comment-input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={MAX_COMMENT_LENGTH}
              rows={3}
              disabled={commentSubmitting}
              placeholder="Share your thoughts..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 disabled:opacity-60 resize-y"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 tabular-nums">
                {commentText.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button
                type="submit"
                disabled={commentSubmitting || commentText.trim().length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl transition-colors shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {commentSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {commentSubmitting ? 'Posting...' : 'Post comment'}
              </button>
            </div>
            {commentError && (
              <p role="alert" className="mt-2 text-xs text-red-600">
                {commentError}
              </p>
            )}
          </form>
        ) : (
          <div className="mb-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600">
            <Link
              to="/admin/login"
              state={{ from: location }}
              className="font-semibold text-indigo-600 hover:underline"
            >
              Sign in
            </Link>{' '}
            to join the conversation.
          </div>
        )}

        {/* List */}
        {commentsLoading ? (
          <div className="py-6">
            <LoadingSpinner message="Loading comments..." />
          </div>
        ) : commentsError ? (
          <p role="alert" className="text-sm text-red-600">
            {commentsError}
          </p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet. Be the first to share your thoughts.</p>
        ) : (
          <ul className="space-y-4">
            {comments.map((c) => {
              const name = c.author_name || 'Reader';
              return (
                <li key={c.id} className="flex gap-3">
                  <div
                    className="w-9 h-9 shrink-0 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold"
                    aria-hidden="true"
                  >
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1 p-3 sm:p-4 rounded-xl bg-white border border-slate-200">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                      <span className="text-sm font-semibold text-slate-800 break-words">{name}</span>
                      <time dateTime={c.created_at} className="text-[11px] text-slate-400">
                        {formatDateTime(c.created_at)}
                      </time>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                      {c.content}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Related / Popular / Recent posts */}
      <MorePosts blogId={blog.blog_id} />
    </article>
  );
};

export default BlogDetailPage;
