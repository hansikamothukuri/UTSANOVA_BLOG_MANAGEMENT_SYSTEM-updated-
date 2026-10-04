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
  id INT AUTO_INCREMENT PRIMARY KEY,
  blog_id VARCHAR(10) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  tags VARCHAR(255) NOT NULL,
  conclusion TEXT NOT NULL,
  image_url VARCHAR(500) NULL,
  image_public_id VARCHAR(255) NULL,
  status ENUM('Draft', 'Scheduled', 'Published') NOT NULL DEFAULT 'Draft',
  scheduled_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blogs_status (status),
  INDEX idx_blogs_scheduled (status, scheduled_at),
  INDEX idx_blogs_created_at (created_at),
  FULLTEXT INDEX idx_blogs_search (title, tags)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
