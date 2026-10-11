-- ============================================================
-- ROLLBACK of migration 004.   *** DESTRUCTIVE - DO NOT RUN WITHOUT YOUR EXPLICIT APPROVAL ***
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- What it removes:
--   * the admin_permissions table (all delegated permission grants are LOST);
--   * admins.is_delegated / is_active / created_by (delegated accounts would become ordinary admins
--     with FULL access - so step 1 deletes the delegated rows first);
--   * blogs.scheduled_at and the 'Scheduled' status.
--
-- Manual procedure:
--   1. Take a backup:  mysqldump -u <user> -p utsanova_blog > backup_before_rollback.sql
--   2. Deploy the previous application version FIRST (it does not know the new columns).
--   3. Review the two SELECTs below, then run this file:
--        mysql -u <user> -p utsanova_blog < database/migrations/004_rollback_permissions_and_scheduling.sql
--   4. Delete the matching Firebase accounts of removed delegated users manually, if wanted
--      (Firebase Console > Authentication > Users).
-- ============================================================
USE utsanova_blog;

-- Review first:
SELECT id, email, is_delegated, is_active FROM admins WHERE is_delegated = 1;
SELECT blog_id, title, scheduled_at FROM blogs WHERE status = 'Scheduled';

-- 1) Delegated accounts must not survive as full-access admins.
DELETE FROM admins WHERE is_delegated = 1;

-- 2) Scheduled blogs go back to Draft (content is kept) - the ENUM cannot shrink while rows use the value.
UPDATE blogs SET status = 'Draft' WHERE status = 'Scheduled';

-- 3) Drop the additions.
ALTER TABLE blogs
  DROP INDEX idx_blogs_status_scheduled,
  DROP COLUMN scheduled_at,
  MODIFY COLUMN status ENUM('Draft', 'Published') NOT NULL DEFAULT 'Draft';

DROP TABLE IF EXISTS admin_permissions;

ALTER TABLE admins
  DROP COLUMN created_by,
  DROP COLUMN is_active,
  DROP COLUMN is_delegated;
