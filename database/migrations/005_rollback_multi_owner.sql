-- ============================================================
-- ROLLBACK of migration 005.   *** DO NOT RUN WITHOUT YOUR EXPLICIT APPROVAL ***
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- Removes admins.is_owner: every database-backed owner designation is LOST. Those accounts are NOT
-- deleted and keep their other data, but they stop being owners.
--
-- Before running:
--   1. mysqldump -u <user> -p utsanova_blog > backup_before_005_rollback.sql
--   2. Record who the owners are:  SELECT id, email, firebase_uid FROM admins WHERE is_owner = 1;
--   3. Make sure OWNER_FIREBASE_UID is set in the environment (the previous application version
--      depends on it) and deploy the previous application version FIRST (it ignores is_owner).
-- Then:  mysql -u <user> -p utsanova_blog < database/migrations/005_rollback_multi_owner.sql
-- ============================================================
USE utsanova_blog;

ALTER TABLE admins
  DROP INDEX idx_admins_owner,
  DROP COLUMN is_owner;
