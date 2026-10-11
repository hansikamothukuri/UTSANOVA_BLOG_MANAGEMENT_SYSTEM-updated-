-- ============================================================
-- Utsanova Blog Management System - Database Schema
-- Database: utsanova_blog
-- ============================================================

CREATE DATABASE IF NOT EXISTS utsanova_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE utsanova_blog;

-- ------------------------------------------------------------
-- Table: admins
-- Purpose: Stores authorized administrator credentials linked to Firebase UID
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  firebase_uid VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_admins_firebase_uid (firebase_uid),
  INDEX idx_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: blogs
-- Purpose: Stores all blog records with draft/published state
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blogs (
  id INT AUTO_INCREMENT PRIMARY KEY,                 -- internal DB id (never exposed by the API)
  blog_id CHAR(4) NOT NULL,                          -- public 4-digit Blog ID: '0001'..'9999'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags VARCHAR(255) NOT NULL,
  conclusion TEXT NOT NULL,
  status ENUM('Draft', 'Published') NOT NULL DEFAULT 'Draft',
  image_url VARCHAR(500) NULL,                       -- Cloudinary secure URL (no image data in MySQL)
  image_public_id VARCHAR(255) NULL,                 -- Cloudinary public ID (used to replace/delete)
  views INT UNSIGNED NOT NULL DEFAULT 0,             -- view counter (see migration 002)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blogs_blog_id (blog_id),
  INDEX idx_blogs_status (status),
  INDEX idx_blogs_created_at (created_at),
  FULLTEXT INDEX idx_blogs_search (title, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: blog_id_counter
-- Purpose: Single-row sequence for the public 4-digit Blog ID.
-- It only ever increases, so the ID of a deleted blog is never reused.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_id_counter (
  id TINYINT UNSIGNED PRIMARY KEY,
  last_value INT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO blog_id_counter (id, last_value) VALUES (1, 0);

-- ------------------------------------------------------------
-- Table: blog_likes
-- Purpose: One row per (blog, Firebase user). UNIQUE key prevents duplicate likes.
-- (same definition as database/migrations/002_add_views_and_likes.sql)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  firebase_uid VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_blog_likes_blog_user (blog_id, firebase_uid),
  INDEX idx_blog_likes_user (firebase_uid),
  CONSTRAINT fk_blog_likes_blog FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Table: blog_comments
-- Purpose: Comments on blogs; author = verified Firebase UID (name resolved via admins)
-- (same definition as database/migrations/003_add_blog_comments.sql)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS blog_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id INT NOT NULL,
  firebase_uid VARCHAR(255) NOT NULL,
  content VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blog_comments_blog_created (blog_id, created_at, id),
  CONSTRAINT fk_blog_comments_blog FOREIGN KEY (blog_id) REFERENCES blogs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
