import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

// Protect all dashboard routes
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/dashboard/stats - Aggregated stats
router.get('/stats', dashboardController.getStats);

// GET /api/admin/dashboard/me - Check current admin session details
router.get('/me', (req, res) => {
  return sendSuccess(res, {
    admin: req.admin,
    user: req.user,
  });
});

export default router;
