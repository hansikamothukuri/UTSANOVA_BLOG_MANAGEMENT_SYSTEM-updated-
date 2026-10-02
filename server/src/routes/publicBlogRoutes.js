import { Router } from 'express';
import blogController from '../controllers/blogController.js';

const router = Router();

// GET /api/blogs - List all published blogs (supports ?search= and ?tag=)
router.get('/', blogController.getPublishedBlogs);

// GET /api/blogs/:id - Get single published blog by ID
router.get('/:id', blogController.getPublishedBlogById);

export default router;
