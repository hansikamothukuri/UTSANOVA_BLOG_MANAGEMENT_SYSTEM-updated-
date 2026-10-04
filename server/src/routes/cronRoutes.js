import { Router } from 'express';
import blogService from '../services/blogService.js';
import { sendError, sendSuccess } from '../utils/apiResponse.js';

const router = Router();

router.post('/publish-scheduled', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Unauthorized', 401);
    }

    const providedSecret = authHeader.slice('Bearer '.length).trim();
    if (providedSecret !== expectedSecret) {
      return sendError(res, 'Unauthorized', 401);
    }

    const publishedCount = await blogService.publishScheduledBlogs();

    return sendSuccess(res, {
      success: true,
      publishedCount,
    });
  } catch (error) {
    console.error('[Cron publish scheduled error]:', error);
    return sendError(res, 'Failed to publish scheduled blogs', 500);
  }
});

export default router;
