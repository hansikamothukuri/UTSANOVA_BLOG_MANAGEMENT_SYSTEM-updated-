export const formatBlogId = (blog) =>
  String(blog?.blog_id ?? blog?.id ?? '').padStart(4, '0');
