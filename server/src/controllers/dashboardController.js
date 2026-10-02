import blogService from '../services/blogService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const dashboardController = {
  /**
   * Admin: Get dashboard stats
   * GET /api/admin/dashboard/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await blogService.getDashboardStats();
      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  },
};

export default dashboardController;
