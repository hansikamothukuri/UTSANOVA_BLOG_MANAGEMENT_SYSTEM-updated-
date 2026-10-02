/**
 * Input validation helpers for Utsanova Blog Management System
 */

export const validateBlogInput = (data) => {
  const errors = [];
  const { title, content, tags, conclusion, status } = data;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    errors.push('Title is required');
  } else if (title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long');
  } else if (title.trim().length > 255) {
    errors.push('Title cannot exceed 255 characters');
  }

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    errors.push('Main content body is required');
  }

  if (!tags || typeof tags !== 'string' || tags.trim().length === 0) {
    errors.push('At least one tag is required');
  }

  if (!conclusion || typeof conclusion !== 'string' || conclusion.trim().length === 0) {
    errors.push('Blog conclusion is required');
  }

  if (!status || !['Draft', 'Published'].includes(status)) {
    errors.push("Status must be either 'Draft' or 'Published'");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Parses and sanitizes pagination query params (page, limit)
 * Falls back to sensible defaults for missing/invalid/negative values
 */
export const parsePagination = (query = {}) => {
  const DEFAULT_PAGE = 1;
  const DEFAULT_LIMIT = 9;
  const MAX_LIMIT = 100;

  let page = parseInt(query.page, 10);
  if (!Number.isInteger(page) || page < 1) {
    page = DEFAULT_PAGE;
  }

  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(limit) || limit < 1) {
    limit = DEFAULT_LIMIT;
  } else if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  return { page, limit };
};

export const sanitizeTags = (tagsInput) => {
  if (!tagsInput || typeof tagsInput !== 'string') return '';
  return tagsInput
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .join(', ');
};
