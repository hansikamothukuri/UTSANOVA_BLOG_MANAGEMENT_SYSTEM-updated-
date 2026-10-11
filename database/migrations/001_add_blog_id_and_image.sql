-- ============================================================
-- Migration 001: public 4-digit Blog ID + Cloudinary image columns
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- Run ONCE against an EXISTING database (fresh installs: use schema.sql instead):
--   mysql -u <user> -p utsanova_blog < database/migrations/001_add_blog_id_and_image.sql
--
-- Safe for existing data: no rows are deleted or modified except for the new columns.
-- Take a backup first (mysqldump) as with any schema change.
-- ============================================================
USE utsanova_blog;

-- 1) New columns. blog_id is nullable only until step 2 backfills it.
ALTER TABLE blogs
  ADD COLUMN blog_id CHAR(4) NULL AFTER id,
  ADD COLUMN image_url VARCHAR(500) NULL AFTER status,
  ADD COLUMN image_public_id VARCHAR(255) NULL AFTER image_url;

-- 2) Backfill existing blogs with sequential 4-digit IDs, oldest first (0001, 0002, ...).
SET @n := 0;
UPDATE blogs
   SET blog_id = LPAD((@n := @n + 1), 4, '0')
 ORDER BY id ASC;

-- 3) Lock it down: required + unique.
ALTER TABLE blogs
  MODIFY COLUMN blog_id CHAR(4) NOT NULL,
  ADD UNIQUE KEY uq_blogs_blog_id (blog_id);

-- 4) Sequence table (only increases => IDs of deleted blogs are never reused).
CREATE TABLE IF NOT EXISTS blog_id_counter (
  id TINYINT UNSIGNED PRIMARY KEY,
  last_value INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO blog_id_counter (id, last_value)
SELECT 1, COALESCE(MAX(CAST(blog_id AS UNSIGNED)), 0) FROM blogs
ON DUPLICATE KEY UPDATE last_value = GREATEST(last_value, VALUES(last_value));

-- 5) Verify (expect: total = distinct_ids, counter >= max_id)
SELECT COUNT(*) AS total,
       COUNT(DISTINCT blog_id) AS distinct_ids,
       MIN(blog_id) AS min_id,
       MAX(blog_id) AS max_id,
       (SELECT last_value FROM blog_id_counter WHERE id = 1) AS counter
  FROM blogs;
