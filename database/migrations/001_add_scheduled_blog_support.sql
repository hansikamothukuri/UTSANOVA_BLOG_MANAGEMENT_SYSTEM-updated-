-- Safe migration for scheduled publishing support.
-- This preserves existing blog data while adding the Scheduled state and nullable scheduled_at column.

ALTER TABLE blogs
  MODIFY status ENUM('Draft', 'Scheduled', 'Published') NOT NULL DEFAULT 'Draft';

ALTER TABLE blogs
  ADD COLUMN scheduled_at DATETIME NULL AFTER status;

CREATE INDEX idx_blogs_scheduled
ON blogs (status, scheduled_at);
