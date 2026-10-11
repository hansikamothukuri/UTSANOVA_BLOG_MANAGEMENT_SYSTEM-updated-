import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { optionalImageUpload } from '../middleware/uploadMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';

const router = Router();

// Protect ALL admin blog routes with Firebase authentication & admin authorization.
// Each route additionally requires its own permission (checked BEFORE any upload is processed).
router.use(authMiddleware, adminMiddleware);

// POST /api/admin/blogs - Create a blog (JSON, or multipart/form-data with an optional "image" file)
router.post('/', requirePermission(PERMISSIONS.BLOG_CREATE), optionalImageUpload, blogController.createBlog);

// GET /api/admin/blogs - List all blogs (drafts + scheduled + published, optional ?status=)
router.get('/', requirePermission(PERMISSIONS.BLOG_READ), blogController.getAllAdminBlogs);

// GET /api/admin/blogs/:id - Get single blog (:id is the public 4-digit Blog ID, e.g. 0001)
router.get('/:id', requirePermission(PERMISSIONS.BLOG_READ), blogController.getAdminBlogById);

// PUT /api/admin/blogs/:id - Update blog (JSON, or multipart with "image" / remove_image=true)
router.put('/:id', requirePermission(PERMISSIONS.BLOG_UPDATE), optionalImageUpload, blogController.updateBlog);

// POST /api/admin/blogs/:id/schedule - Schedule / reschedule { scheduled_at }
router.post('/:id/schedule', requirePermission(PERMISSIONS.BLOG_UPDATE), blogController.scheduleBlog);

// POST /api/admin/blogs/:id/cancel-schedule - Cancel a scheduled publication (back to Draft)
router.post('/:id/cancel-schedule', requirePermission(PERMISSIONS.BLOG_UPDATE), blogController.cancelSchedule);

// DELETE /api/admin/blogs/:id - Delete blog
router.delete('/:id', requirePermission(PERMISSIONS.BLOG_DELETE), blogController.deleteBlog);

export default router;
