import crypto from 'node:crypto';
import { Router } from 'express';
import scheduleService from '../services/scheduleService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const MIN_SECRET_LENGTH = 32;

const safeEqual = (a, b) => {
  // Hash both sides so lengths are equal and the comparison is constant-time.
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

/**
 * Cron authentication: `Authorization: Bearer <CRON_SECRET>`. The secret lives only in the deployment
 * environment and in GitHub Secrets. If it is unset/too short the endpoint is disabled (503) so a
 * misconfiguration can never leave it open. The secret is never logged or echoed.
 */
export const cronAuth = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET || '';
  if (secret.length < MIN_SECRET_LENGTH) {
    return sendError(res, 'Cron endpoint is not configured', 503);
  }
  const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!match || !safeEqual(match[1].trim(), secret)) {
    return sendError(res, 'Unauthorized', 401);
  }
  return next();
};

// Strict boolean parsing: an unrecognised dry_run value is rejected (never silently treated as "live").
const parseDryRun = (value) => {
  if (value === undefined || value === null || value === '') return { value: false };
  if (value === true || value === 'true' || value === '1' || value === 1) return { value: true };
  if (value === false || value === 'false' || value === '0' || value === 0) return { value: false };
  return { error: true };
};

export const publishScheduledBlogs = async (req, res, next) => {
  try {
    const parsed = parseDryRun(req.body?.dry_run ?? req.query?.dry_run);
    if (parsed.error) return sendError(res, 'dry_run must be true or false', 400);
    const result = await scheduleService.publishDue({ dryRun: parsed.value });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
};

const router = Router();

// POST /api/cron/publish-scheduled-blogs   (body or query: dry_run=true for a read-only check)
router.post('/publish-scheduled-blogs', cronAuth, publishScheduledBlogs);

export default router;
