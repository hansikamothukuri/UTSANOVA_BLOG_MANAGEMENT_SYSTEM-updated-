import { Router } from 'express';
import blogController from '../controllers/blogController.js';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware.js';

const router = Router();

// GET /api/blogs - List all published blogs (supports ?search= and ?tag=)
router.get('/', blogController.getPublishedBlogs);

// GET /api/blogs/:id - Get single published blog by ID
router.get('/:id', blogController.getPublishedBlogById);

// GET /api/blogs/:id/related - Related published blogs (shared tags)
router.get('/:id/related', blogController.getRelatedBlogs);

// POST /api/blogs/:id/view - Count one view of a published blog (public)
router.post('/:id/view', blogController.recordView);

// GET /api/blogs/:id/likes - Like count (+ "liked by me" when a valid Firebase token is sent)
router.get('/:id/likes', optionalAuthMiddleware, blogController.getLikes);

// POST/DELETE /api/blogs/:id/like - Like / unlike (requires a verified Firebase user, not admin)
router.post('/:id/like', authMiddleware, blogController.likeBlog);
router.delete('/:id/like', authMiddleware, blogController.unlikeBlog);

// GET /api/blogs/:id/comments - Comments of a published blog, oldest first (public)
router.get('/:id/comments', blogController.getComments);

// POST /api/blogs/:id/comments - Add a comment (requires a verified Firebase user, not admin)
router.post('/:id/comments', authMiddleware, blogController.addComment);

export default router;
