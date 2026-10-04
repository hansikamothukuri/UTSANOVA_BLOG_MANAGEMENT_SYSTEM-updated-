import blogService from '../services/blogService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { validateBlogInput, sanitizeTags, parsePagination } from '../utils/validators.js';
import { deleteCloudinaryImage, uploadImageToCloudinary } from '../config/cloudinary.js';

const ADMIN_BLOGS_PER_PAGE = 9;

const isCloudinaryImageMetadata = (imageUrl, imagePublicId) => {
  if (!imageUrl && !imagePublicId) return true;
  if (!imageUrl || !imagePublicId) return false;

  try {
    const parsedUrl = new URL(imageUrl);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    return Boolean(
      cloudName &&
        parsedUrl.protocol === 'https:' &&
        parsedUrl.hostname === 'res.cloudinary.com' &&
        parsedUrl.pathname.startsWith(`/${cloudName}/image/upload/`) &&
        imagePublicId.trim()
    );
  } catch {
    return false;
  }
};

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
      const result = await blogService.getPublishedBlogs({ search, tag, page, limit });
      return sendSuccess(res, result);
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
      const { id } = req.params;
      const blog = await blogService.getPublishedBlogById(id);

      if (!blog) {
        return sendError(res, 'Blog not found', 404);
      }

      return sendSuccess(res, blog);
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
      const { id } = req.params;
      const blog = await blogService.getBlogById(id);

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
    let uploadedImage;
    try {
      const {
        title,
        content,
        tags,
        conclusion,
        status,
        scheduled_at,
        image_url,
        image_public_id,
      } = req.body;
      const cleanTags = sanitizeTags(tags);

      if (!req.file && !isCloudinaryImageMetadata(image_url, image_public_id)) {
        return sendError(res, 'Image metadata must be a valid Cloudinary URL and public ID.', 400);
      }

      const validation = validateBlogInput({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        scheduled_at,
      });

      if (!validation.isValid) {
        return sendError(res, validation.errors.join('. '), 400);
      }

      if (req.file) {
        uploadedImage = await uploadImageToCloudinary(req.file.buffer);
      }

      const newBlog = await blogService.createBlog({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        scheduled_at: status === 'Scheduled' ? scheduled_at : null,
        image_url: uploadedImage?.image_url ?? image_url ?? null,
        image_public_id: uploadedImage?.image_public_id ?? image_public_id ?? null,
      });

      return sendSuccess(res, newBlog, 201);
    } catch (error) {
      if (uploadedImage?.image_public_id) {
        try {
          await deleteCloudinaryImage(uploadedImage.image_public_id);
        } catch (cleanupError) {
          console.error('[Cloudinary upload compensation error]:', cleanupError.message);
        }
      }
      next(error);
    }
  },

  /**
   * Admin: Update blog
   * PUT /api/admin/blogs/:id
   */
  async updateBlog(req, res, next) {
    let uploadedImage;
    try {
      const { id } = req.params;
      const {
        title,
        content,
        tags,
        conclusion,
        status,
        scheduled_at,
        image_url,
        image_public_id,
      } = req.body;
      const existing = await blogService.getBlogById(id);
      if (!existing) {
        return sendError(res, 'Blog not found', 404);
      }

      if (!req.file && !isCloudinaryImageMetadata(image_url, image_public_id)) {
        return sendError(res, 'Image metadata must be a valid Cloudinary URL and public ID.', 400);
      }

      const cleanTags = sanitizeTags(tags);

      const validation = validateBlogInput({
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        scheduled_at,
      });

      if (!validation.isValid) {
        return sendError(res, validation.errors.join('. '), 400);
      }

      if (req.file) {
        uploadedImage = await uploadImageToCloudinary(req.file.buffer);
      }

      const updated = await blogService.updateBlog(id, {
        title,
        content,
        tags: cleanTags,
        conclusion,
        status,
        scheduled_at: status === 'Scheduled' ? scheduled_at : null,
        ...(uploadedImage || (image_url && image_public_id
          ? { image_url, image_public_id }
          : {})),
      });

      if (!updated) {
        if (uploadedImage?.image_public_id) {
          await deleteCloudinaryImage(uploadedImage.image_public_id);
          uploadedImage = null;
        }
        return sendError(res, 'Blog not found', 404);
      }

      const newImagePublicId = uploadedImage?.image_public_id ?? image_public_id;
      if (newImagePublicId && existing.image_public_id !== newImagePublicId) {
        try {
          await deleteCloudinaryImage(existing.image_public_id);
        } catch (cleanupError) {
          console.error('[Cloudinary replaced-image cleanup error]:', cleanupError.message);
          return sendError(
            res,
            'Blog was updated, but its previous Cloudinary image could not be removed.',
            502
          );
        }
      }

      return sendSuccess(res, updated, 200);
    } catch (error) {
      if (uploadedImage?.image_public_id) {
        try {
          await deleteCloudinaryImage(uploadedImage.image_public_id);
        } catch (cleanupError) {
          console.error('[Cloudinary upload compensation error]:', cleanupError.message);
        }
      }
      next(error);
    }
  },

  /**
   * Admin: Delete blog
   * DELETE /api/admin/blogs/:id
   */
  async deleteBlog(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await blogService.getBlogById(id);
      if (!existing) {
        return sendError(res, 'Blog not found', 404);
      }

      const success = await blogService.deleteBlog(id);

      if (!success) {
        return sendError(res, 'Blog not found', 404);
      }

      if (existing.image_public_id) {
        try {
          await deleteCloudinaryImage(existing.image_public_id);
        } catch (cleanupError) {
          console.error('[Cloudinary deleted-blog image cleanup error]:', cleanupError.message);
          return sendError(
            res,
            'Blog was deleted, but its Cloudinary image could not be removed.',
            502
          );
        }
      }

      return sendSuccess(res, { message: 'Blog deleted successfully', id: Number(id) });
    } catch (error) {
      next(error);
    }
  },
};

export default blogController;
