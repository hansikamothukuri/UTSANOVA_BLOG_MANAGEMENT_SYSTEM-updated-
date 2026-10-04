-- Add the legacy four-digit blog identifier and Cloudinary metadata without
-- changing existing primary keys or replacing the blogs table.
DROP PROCEDURE IF EXISTS migrate_blog_ids_and_images;
DELIMITER //
CREATE PROCEDURE migrate_blog_ids_and_images()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'blogs'
      AND COLUMN_NAME = 'blog_id'
  ) THEN
    ALTER TABLE blogs ADD COLUMN blog_id VARCHAR(10) NULL AFTER id;
  END IF;

  UPDATE blogs
  SET blog_id = LPAD(CAST(id AS CHAR), 4, '0')
  WHERE blog_id IS NULL OR blog_id = '';

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'blogs'
      AND COLUMN_NAME = 'blog_id'
      AND NON_UNIQUE = 0
  ) THEN
    CREATE UNIQUE INDEX uq_blogs_blog_id ON blogs (blog_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'blogs'
      AND COLUMN_NAME = 'image_url'
  ) THEN
    ALTER TABLE blogs ADD COLUMN image_url VARCHAR(500) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'blogs'
      AND COLUMN_NAME = 'image_public_id'
  ) THEN
    ALTER TABLE blogs ADD COLUMN image_public_id VARCHAR(255) NULL;
  END IF;
END//
DELIMITER ;

CALL migrate_blog_ids_and_images();
DROP PROCEDURE migrate_blog_ids_and_images;
