-- ============================================================
-- Migration 005: database-backed multi-owner support
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- PREREQUISITE: migration 004 (admins / admin_permissions) must already be applied.
-- Run ONCE against an EXISTING database (fresh installs: use schema.sql instead):
--   mysql -u <user> -p utsanova_blog < database/migrations/005_add_multi_owner.sql
--
-- NOT automatic: nothing runs this for you. Take a backup first (mysqldump).
--
-- Reuses the existing `admins` table (no new table): one additive column. Every existing row gets
-- is_owner = 0, so NOBODY becomes an owner by running this - no access changes for existing accounts.
-- Owners come from (a) OWNER_FIREBASE_UID in the server environment (bootstrap owners, no DB write
-- needed) and (b) other owners promoting people through Manage Users.
--
-- MySQL cannot "ADD COLUMN IF NOT EXISTS", so this script is not re-runnable. Check first (expect 0 rows):
--   SELECT COLUMN_NAME FROM information_schema.COLUMNS
--    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'is_owner';
-- ============================================================
USE utsanova_blog;

ALTER TABLE admins
  ADD COLUMN is_owner TINYINT(1) NOT NULL DEFAULT 0,
  ADD INDEX idx_admins_owner (is_owner, is_active);

-- OPTIONAL manual bootstrap of the FIRST database owner (needs your explicit approval; it is
-- commented out on purpose). Prefer OWNER_FIREBASE_UID in the environment - it needs no SQL at all.
-- Use the verified Firebase UID of the person (Firebase Console > Authentication > Users > User UID),
-- never an email address:
--   UPDATE admins SET is_owner = 1 WHERE firebase_uid = '<FIREBASE_UID>' AND is_active = 1;
--   SELECT id, email, is_owner FROM admins WHERE is_owner = 1;   -- expect exactly the rows you intended

-- Verify (expect the column present and 0 owners until you or a bootstrap owner promotes someone):
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'admins' AND COLUMN_NAME = 'is_owner';
SELECT COUNT(*) AS owners FROM admins WHERE is_owner = 1;
