import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { optionalImageUpload } from '../middleware/uploadMiddleware.js';

const router = Router();

// Protect ALL admin blog routes with Firebase authentication & admin authorization
router.use(authMiddleware, adminMiddleware);

// POST /api/admin/blogs - Create a blog (JSON, or multipart/form-data with an optional "image" file)
router.post('/', optionalImageUpload, blogController.createBlog);

// GET /api/admin/blogs - List all blogs (drafts + published, optional ?status=)
router.get('/', blogController.getAllAdminBlogs);

// GET /api/admin/blogs/:id - Get single blog (:id is the public 4-digit Blog ID, e.g. 0001)
router.get('/:id', blogController.getAdminBlogById);

// PUT /api/admin/blogs/:id - Update blog (JSON, or multipart with "image" / remove_image=true)
router.put('/:id', optionalImageUpload, blogController.updateBlog);

// DELETE /api/admin/blogs/:id - Delete blog
router.delete('/:id', blogController.deleteBlog);

export default router;
