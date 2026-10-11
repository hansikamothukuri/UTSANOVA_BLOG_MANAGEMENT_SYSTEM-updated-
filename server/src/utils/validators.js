/**
 * Input validation helpers for Utsanova Blog Management System
 */

// 'Scheduled' (migration 004) = hidden from the public until scheduled_at has passed and the cron publishes it
export const BLOG_STATUSES = ['Draft', 'Published', 'Scheduled'];

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

  if (!status || !BLOG_STATUSES.includes(status)) {
    errors.push("Status must be 'Draft', 'Published' or 'Scheduled'");
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

/**
 * Validates the public Blog ID from a URL: exactly 4 digits ("0001"). Returns the ID or null.
 */
export const parseBlogId = (value) => {
  const v = String(value ?? '').trim();
  return /^\d{4}$/.test(v) ? v : null;
};

export const MAX_COMMENT_LENGTH = 1000;

/**
 * Validates a comment body. Returns { value, error }: `value` is the trimmed text to store,
 * `error` is a message (or null). Whitespace-only text counts as empty.
 */
export const validateCommentInput = (data) => {
  const raw = data && typeof data === 'object' ? data.content : undefined;
  if (typeof raw !== 'string') {
    return { value: null, error: 'Comment text is required' };
  }
  const value = raw.trim();
  if (value.length === 0) {
    return { value: null, error: 'Comment cannot be empty' };
  }
  if (value.length > MAX_COMMENT_LENGTH) {
    return { value: null, error: `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters` };
  }
  return { value, error: null };
};

// Allowlist of public blog list sort options (the service maps each key to a fixed ORDER BY clause)
export const BLOG_SORT_OPTIONS = ['latest', 'oldest', 'popular'];

/** Returns a valid sort key; anything unknown/missing falls back to 'latest'. */
export const parseSort = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return BLOG_SORT_OPTIONS.includes(v) ? v : 'latest';
};
