import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';

const router = Router();

// Protect ALL admin blog routes with Firebase authentication & admin authorization
router.use(authMiddleware, adminMiddleware);

// POST /api/admin/blogs - Create a blog
router.post('/', blogController.createBlog);

// GET /api/admin/blogs - List all blogs (drafts + published, optional ?status=)
router.get('/', blogController.getAllAdminBlogs);

// GET /api/admin/blogs/:id - Get single blog by ID
router.get('/:id', blogController.getAdminBlogById);

// PUT /api/admin/blogs/:id - Update blog
router.put('/:id', blogController.updateBlog);

// DELETE /api/admin/blogs/:id - Delete blog
router.delete('/:id', blogController.deleteBlog);

export default router;
