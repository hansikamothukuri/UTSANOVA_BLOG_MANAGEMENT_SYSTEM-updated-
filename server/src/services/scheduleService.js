import db from '../config/db.js';
import { withMigrationHint } from '../utils/httpError.js';
import { toMysqlUtc, toUtcIso } from '../utils/schedule.js';

export const MAX_PUBLISH_BATCH = 50;

export const scheduleService = {
  /**
   * Publishes every Scheduled blog whose scheduled_at has arrived (UTC comparison).
   *
   * Concurrency: each blog is claimed with ONE conditional statement
   *   UPDATE ... SET status='Published' WHERE id=? AND status='Scheduled' AND scheduled_at <= ?
   * InnoDB serialises concurrent claims on the row, so exactly one cron run flips it and counts it;
   * the other sees affectedRows = 0 (already published, cancelled or rescheduled since) and skips it.
   * created_at is never written. dryRun only reads: nothing is modified.
   */
  async publishDue({ dryRun = false, now = new Date(), limit = MAX_PUBLISH_BATCH } = {}) {
    const nowUtc = toMysqlUtc(now);
    return withMigrationHint(async () => {
      const [due] = await db.query(
        "SELECT id, blog_id, title, scheduled_at FROM blogs WHERE status = 'Scheduled' AND scheduled_at <= ? ORDER BY scheduled_at ASC, id ASC LIMIT ?",
        [nowUtc, limit]
      );
      const [pendingRows] = await db.query("SELECT COUNT(*) AS pending FROM blogs WHERE status = 'Scheduled' AND scheduled_at > ?", [nowUtc]);
      const base = {
        dry_run: dryRun,
        now: now.toISOString(),
        still_scheduled: Number(pendingRows[0]?.pending || 0),
      };
      const describe = (b) => ({ blog_id: String(b.blog_id), title: b.title, scheduled_at: toUtcIso(b.scheduled_at) });

      if (dryRun) {
        return { ...base, due_count: due.length, would_publish: due.map(describe), published_count: 0, published: [], skipped_count: 0 };
      }

      const published = [];
      let skipped = 0;
      for (const blog of due) {
        const [result] = await db.query(
          "UPDATE blogs SET status = 'Published' WHERE id = ? AND status = 'Scheduled' AND scheduled_at <= ?",
          [blog.id, nowUtc]
        );
        if (result?.affectedRows === 1) published.push(describe(blog));
        else skipped += 1;
      }
      return { ...base, due_count: due.length, published_count: published.length, published, skipped_count: skipped };
    });
  },
};

export default scheduleService;
