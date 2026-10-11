-- ============================================================
-- Migration 003: blog comments
-- Database: utsanova_blog      (MySQL 5.7+ / 8.x)
--
-- Run against an EXISTING database (fresh installs: use schema.sql instead):
--   mysql -u <user> -p utsanova_blog < database/migrations/003_add_blog_comments.sql
--
-- Safe to re-run (CREATE TABLE IF NOT EXISTS). It only ADDS a table: no existing table, column
-- or row is modified or deleted. Requires the blogs table (and migration 002 is NOT a prerequisite).
-- Take a backup first (mysqldump).
-- ============================================================
USE utsanova_blog;

-- One row per comment. The author is the verified Firebase UID taken from the ID token on the
-- server (never from the request body); the display name is resolved by joining admins.firebase_uid.
-- Comments are removed automatically when their blog is deleted (ON DELETE CASCADE).
CREATE TABLE IF NOT EXISTS blog_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,                              -- blogs.id (internal id)
  firebase_uid VARCHAR(255) NOT NULL,                -- verified Firebase UID of the author
  content VARCHAR(1000) NOT NULL,                    -- trimmed server-side, max 1000 characters
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blog_comments_blog_created (blog_id, created_at, id),   -- list a blog's comments oldest first
  CONSTRAINT fk_blog_comments_blog FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
