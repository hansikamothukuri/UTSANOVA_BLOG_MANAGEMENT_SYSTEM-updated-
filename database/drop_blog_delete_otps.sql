-- ============================================================
-- OPTIONAL, MANUAL cleanup: removes the obsolete blog_delete_otps table.
-- NOT executed automatically. Only affects the OTP table; the admins and
-- blogs tables (and all blog data) are untouched.
-- Run only if you previously applied the OTP migration:
--   mysql -u root -p utsanova_blog < database/drop_blog_delete_otps.sql
-- ============================================================
USE utsanova_blog;
DROP TABLE IF EXISTS blog_delete_otps;
-- If you created the optional purge event, remove it too:
DROP EVENT IF EXISTS evt_purge_blog_delete_otps;
