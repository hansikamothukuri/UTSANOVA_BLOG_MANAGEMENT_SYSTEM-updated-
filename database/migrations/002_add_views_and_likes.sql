-- ============================================================
-- Migration 002: blog view counter + per-user likes
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- Run against an EXISTING database (fresh installs: use schema.sql instead):
--   mysql -u <user> -p utsanova_blog < database/migrations/002_add_views_and_likes.sql
--
-- Safe to re-run: the views column is only added if missing and the table uses
-- CREATE TABLE IF NOT EXISTS. No existing rows are modified or deleted
-- (existing blogs simply start at views = 0). Take a backup first (mysqldump).
-- ============================================================
USE utsanova_blog;

-- 1) blogs.views (skipped if the column already exists)
SET @has_views := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blogs' AND COLUMN_NAME = 'views'
);
SET @sql := IF(@has_views = 0,
  'ALTER TABLE blogs ADD COLUMN views INT UNSIGNED NOT NULL DEFAULT 0 AFTER image_public_id',
  'SELECT ''blogs.views already exists'' AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) blog_likes: one row per (blog, Firebase user). The UNIQUE key makes duplicate likes
--    impossible at the database level; rows are removed automatically with their blog.
CREATE TABLE IF NOT EXISTS blog_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,                              -- blogs.id (internal id)
  firebase_uid VARCHAR(255) NOT NULL,                -- verified Firebase UID (from the ID token)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_likes_blog_user (blog_id, firebase_uid),
  INDEX idx_blog_likes_user (firebase_uid),
  CONSTRAINT fk_blog_likes_blog FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
