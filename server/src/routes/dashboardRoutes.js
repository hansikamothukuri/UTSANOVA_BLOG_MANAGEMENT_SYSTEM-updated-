import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { adminMiddleware } from '../middleware/adminMiddleware.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import { PERMISSIONS } from '../utils/permissions.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

// Protect all dashboard routes
router.use(authMiddleware, adminMiddleware);

// GET /api/admin/dashboard/stats - Aggregated stats
router.get('/stats', requirePermission(PERMISSIONS.BLOG_READ), dashboardController.getStats);

// GET /api/admin/dashboard/me - Check current admin session details
router.get('/me', (req, res) => {
  return sendSuccess(res, {
    admin: req.admin,
    user: req.user,
    // What this account may do (used by the UI to show/hide controls; the backend enforces it anyway)
    access: {
      role: req.access.role,
      is_owner: req.access.isOwner,
      is_bootstrap_owner: Boolean(req.access.isBootstrapOwner),
      admin_id: req.admin?.id ?? null,
      permissions: req.access.permissions,
    },
  });
});

export default router;
