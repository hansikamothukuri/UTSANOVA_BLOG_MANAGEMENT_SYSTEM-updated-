-- ============================================================
-- Migration 004: permission-based admin access + scheduled publishing
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- Run ONCE against an EXISTING database (fresh installs: use schema.sql instead):
--   mysql -u <user> -p utsanova_blog < database/migrations/004_add_permissions_and_scheduling.sql
--
-- NOT automatic: nothing runs this for you. Take a backup first (mysqldump).
--
-- Additive and data-preserving:
--   * existing admins keep FULL blog access (is_delegated defaults to 0 = "legacy admin");
--   * existing Draft / Published blogs are not touched (scheduled_at is NULL);
--   * no blog is converted to Scheduled and nothing is published.
--
-- MySQL cannot "ADD COLUMN IF NOT EXISTS", so this script is not re-runnable. Check first (expect 0 rows):
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE()
--      AND ((TABLE_NAME = 'admins' AND COLUMN_NAME IN ('is_delegated','is_active','created_by'))
--        OR (TABLE_NAME = 'blogs'  AND COLUMN_NAME = 'scheduled_at'));
-- If rows come back, the migration (or part of it) was already applied: do NOT run it again.
-- ============================================================
USE utsanova_blog;

-- 1) admins: delegated flag, enabled flag, who provisioned the account.
--    is_delegated = 0  -> legacy admin: keeps full BLOG_* access exactly as before (never manages users)
--    is_delegated = 1  -> delegated: only the permissions stored in admin_permissions
ALTER TABLE admins
  ADD COLUMN is_delegated TINYINT(1) NOT NULL DEFAULT 0 AFTER name,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER is_delegated,
  ADD COLUMN created_by VARCHAR(255) NULL AFTER is_active;

-- 2) One row per (admin, permission). Codes: BLOG_READ, BLOG_CREATE, BLOG_UPDATE, BLOG_DELETE.
--    Rows are removed automatically when the admin row is deleted.
CREATE TABLE IF NOT EXISTS admin_permissions (
  admin_id INT NOT NULL,
  permission VARCHAR(32) NOT NULL,
  granted_by VARCHAR(255) NULL,                      -- Firebase UID of the owner who granted it
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id, permission),
  CONSTRAINT fk_admin_permissions_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3) blogs: new 'Scheduled' status + publication time.
--    scheduled_at is a naive DATETIME that ALWAYS means UTC (the app shows Asia/Kolkata to users).
--    created_at is not touched, so publishing a scheduled blog never changes it.
ALTER TABLE blogs
  MODIFY COLUMN status ENUM('Draft', 'Published', 'Scheduled') NOT NULL DEFAULT 'Draft',
  ADD COLUMN scheduled_at DATETIME NULL AFTER image_public_id,
  ADD INDEX idx_blogs_status_scheduled (status, scheduled_at);

-- 4) Verify (expect: columns present, status enum has 3 values, nothing scheduled yet, draft/published counts unchanged)
SELECT COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
   AND ((TABLE_NAME = 'admins' AND COLUMN_NAME IN ('is_delegated','is_active','created_by'))
     OR (TABLE_NAME = 'blogs'  AND COLUMN_NAME IN ('status','scheduled_at')));
SELECT status, COUNT(*) AS total FROM blogs GROUP BY status;
