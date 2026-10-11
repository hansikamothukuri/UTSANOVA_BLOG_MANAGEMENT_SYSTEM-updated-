import blogService from '../services/blogService.js';
import imageService from '../services/imageService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { validateBlogInput, sanitizeTags, parsePagination, parseBlogId, validateCommentInput, parseSort } from '../utils/validators.js';
import { parseScheduledAt } from '../utils/schedule.js';
import { validateImageFile } from '../utils/imageValidation.js';
import { compressImage } from '../utils/imageCompression.js';

const ADMIN_BLOGS_PER_PAGE = 9;

export const blogController = {
  /**
   * Public: Get all published blogs with optional search/tag filter
   * Supports pagination via ?page= and ?limit= (defaults: page=1, limit=9)
   * GET /api/blogs?page=1&limit=9
   */
  async getPublishedBlogs(req, res, next) {
    try {
      const { search, tag } = req.query;
      const { page, limit } = parsePagination(req.query);
      const sort = parseSort(req.query.sort); // allowlist: latest | oldest | popular
      const result = await blogService.getPublishedBlogs({ search, tag, page, limit, sort });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public: related published blogs (shared tags), excluding the blog itself
   * GET /api/blogs/:id/related?limit=3  ->  { blogs: [...] }
   */
  async getRelatedBlogs(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      let limit = parseInt(req.query.limit, 10);
      if (!Number.isInteger(limit) || limit < 1) limit = 3;
      limit = Math.min(limit, 6);
      const blogs = blogId ? await blogService.getRelatedBlogs(blogId, limit) : null;
      if (!blogs) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, { blogs });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public: Get single published blog by ID
   * GET /api/blogs/:id
   */
  async getPublishedBlogById(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const blog = blogId ? await blogService.getPublishedBlogById(blogId) : null;

      if (!blog) {
        return sendError(res, 'Blog not found', 404);
      }

      return sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public: count one view of a published blog (the client calls this once per browser session)
   * POST /api/blogs/:id/view  ->  { views }
   */
  async recordView(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const views = blogId ? await blogService.incrementViews(blogId) : null;
      if (views === null) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, { views });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public (token optional): like count + whether the signed-in user liked this blog
   * GET /api/blogs/:id/likes  ->  { like_count, liked }
   */
  async getLikes(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const state = blogId ? await blogService.getLikeState(blogId, req.user?.uid) : null;
      if (!state) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, state);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Authenticated (any verified Firebase user): like / unlike. The user is ALWAYS taken from the
   * verified token (req.user.uid) - nothing identity-related is read from the request body.
   * POST   /api/blogs/:id/like
   * DELETE /api/blogs/:id/like
   */
  async likeBlog(req, res, next) {
    return blogController._setLike(req, res, next, true);
  },

  async unlikeBlog(req, res, next) {
    return blogController._setLike(req, res, next, false);
  },

  async _setLike(req, res, next, shouldLike) {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return sendError(res, 'Unauthorized: User identifier missing', 401);
      }
      const blogId = parseBlogId(req.params.id);
      const state = blogId ? await blogService.setLike(blogId, uid, shouldLike) : null;
      if (!state) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, state);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Public: comments of a published blog, oldest first
   * GET /api/blogs/:id/comments  ->  { comments: [{ id, content, created_at, author_name }] }
   */
  async getComments(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const comments = blogId ? await blogService.getComments(blogId) : null;
      if (!comments) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, { comments });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Authenticated (any verified Firebase user): add a comment. The author is ALWAYS req.user.uid
   * from the verified token; only `content` is read from the body.
   * POST /api/blogs/:id/comments  { content }  ->  201 { comment }
   */
  async addComment(req, res, next) {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return sendError(res, 'Unauthorized: User identifier missing', 401);
      }
      const blogId = parseBlogId(req.params.id);
      if (!blogId) {
        return sendError(res, 'Blog not found', 404);
      }
      const { value, error } = validateCommentInput(req.body);
      if (error) {
        return sendError(res, error, 400);
      }
      const comment = await blogService.addComment(blogId, uid, value);
      if (!comment) {
        return sendError(res, 'Blog not found', 404);
      }
      return sendSuccess(res, { comment }, 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin: Get blogs (Draft + Published), paginated
   * GET /api/admin/blogs?page=1&limit=9[&status=Draft|Published][&search=term]
   * The admin list is always 9 per page (ADMIN_BLOGS_PER_PAGE).
   */
  async getAllAdminBlogs(req, res, next) {
    try {
      const { status, search } = req.query;
      const { page } = parsePagination(req.query);
      const result = await blogService.getAdminBlogs({
        status,
        search,
        page,
        limit: ADMIN_BLOGS_PER_PAGE,
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin: Get single blog by ID
   * GET /api/admin/blogs/:id
   */
  async getAdminBlogById(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const blog = blogId ? await blogService.getBlogById(blogId) : null;

      if (!blog) {
        return sendError(res, 'Blog not found', 404);
      }

      return sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin: Create a new blog
   * POST /api/admin/blogs
   */
  async createBlog(req, res, next) {
    let uploaded = null;
    try {
      // NOTE: any blog_id in the request is ignored - it is generated on the server.
      const { title, content, tags, conclusion, status, scheduled_at } = req.body;
      const cleanTags = sanitizeTags(tags);

      const validation = validateBlogInput({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
      });

      if (!validation.isValid) {
        return sendError(res, validation.errors.join('. '), 400);
      }

      // Scheduled blogs need a valid FUTURE time (no zone = Asia/Kolkata); stored as UTC.
      let scheduledAt = null;
      if (status === 'Scheduled') {
        const parsed = parseScheduledAt(scheduled_at);
        if (parsed.error) return sendError(res, parsed.error, 400);
        scheduledAt = parsed.value;
      }

      if (req.file) {
        const imageError = validateImageFile(req.file);
        if (imageError) return sendError(res, imageError, 400);
        // Compress (same format, max 2000px) before storing; rejects corrupt images
        const processed = await compressImage(req.file);
        if (processed.error) return sendError(res, processed.error, 400);
        uploaded = await imageService.upload(processed.buffer);
      }

      const newBlog = await blogService.createBlog({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        image: uploaded,
        scheduledAt,
      });

      return sendSuccess(res, newBlog, 201);
    } catch (error) {
      // The blog was not saved: do not leave the freshly uploaded image orphaned in Cloudinary.
      if (uploaded) await imageService.remove(uploaded.publicId);
      next(error);
    }
  },

  /**
   * Admin: Update blog
   * PUT /api/admin/blogs/:id
   */
  async updateBlog(req, res, next) {
    let uploaded = null;
    try {
      const blogId = parseBlogId(req.params.id);
      const { title, content, tags, conclusion, status, scheduled_at } = req.body;
      const cleanTags = sanitizeTags(tags);

      const validation = validateBlogInput({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
      });

      if (!validation.isValid) {
        return sendError(res, validation.errors.join('. '), 400);
      }

      let scheduledAt;
      if (status === 'Scheduled') {
        const parsed = parseScheduledAt(scheduled_at);
        if (parsed.error) return sendError(res, parsed.error, 400);
        scheduledAt = parsed.value;
      }

      const existing = blogId ? await blogService.getRawByBlogId(blogId) : null;
      if (!existing) {
        return sendError(res, 'Blog not found', 404);
      }

      // A published blog is never silently turned back into Draft/Scheduled by a schedule request.
      if (status === 'Scheduled' && existing.status === 'Published') {
        return sendError(res, 'This blog is already published and cannot be scheduled', 409, { code: 'ALREADY_PUBLISHED' });
      }

      if (req.file) {
        const imageError = validateImageFile(req.file);
        if (imageError) return sendError(res, imageError, 400);
        // Compress (same format, max 2000px) before storing; rejects corrupt images
        const processed = await compressImage(req.file);
        if (processed.error) return sendError(res, processed.error, 400);
        uploaded = await imageService.upload(processed.buffer);
      }

      const removeImage = !uploaded && String(req.body.remove_image).toLowerCase() === 'true';

      const updated = await blogService.updateBlog(blogId, {
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        image: uploaded,
        removeImage,
        scheduledAt,
      });

      if (!updated) {
        if (uploaded) await imageService.remove(uploaded.publicId);
        return sendError(res, 'Blog not found', 404);
      }

      // DB now points at the new image (or none): the old file is unused, so delete it.
      if (existing.image_public_id && (uploaded || removeImage)) {
        await imageService.remove(existing.image_public_id);
      }

      return sendSuccess(res, updated, 200);
    } catch (error) {
      if (uploaded) await imageService.remove(uploaded.publicId);
      next(error);
    }
  },

  /**
   * Admin (BLOG_UPDATE): schedule or reschedule a blog.
   * POST /api/admin/blogs/:id/schedule  { scheduled_at }   409 if the blog is already Published
   */
  async scheduleBlog(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const parsed = parseScheduledAt(req.body?.scheduled_at);
      if (parsed.error) return sendError(res, parsed.error, 400);
      const blog = blogId ? await blogService.scheduleBlog(blogId, parsed.value) : null;
      if (!blog) return sendError(res, 'Blog not found', 404);
      return sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin (BLOG_UPDATE): cancel a scheduled publication (the blog returns to Draft, content kept).
   * POST /api/admin/blogs/:id/cancel-schedule   409 if the blog is not Scheduled
   */
  async cancelSchedule(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const blog = blogId ? await blogService.cancelSchedule(blogId) : null;
      if (!blog) return sendError(res, 'Blog not found', 404);
      return sendSuccess(res, blog);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Admin: Delete blog
   * DELETE /api/admin/blogs/:id
   */
  async deleteBlog(req, res, next) {
    try {
      const blogId = parseBlogId(req.params.id);
      const existing = blogId ? await blogService.getRawByBlogId(blogId) : null;
      if (!existing) {
        return sendError(res, 'Blog not found', 404);
      }

      const success = await blogService.deleteBlog(blogId);
      if (!success) {
        return sendError(res, 'Blog not found', 404);
      }

      // Row is gone; remove its Cloudinary image too (best effort, logged on failure).
      if (existing.image_public_id) {
        await imageService.remove(existing.image_public_id);
      }

      return sendSuccess(res, { message: 'Blog deleted successfully', blog_id: blogId });
    } catch (error) {
      next(error);
    }
  },
};

export default blogController;
