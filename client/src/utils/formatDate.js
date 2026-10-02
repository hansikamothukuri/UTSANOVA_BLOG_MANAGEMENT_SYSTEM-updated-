/**
 * Date formatting and text utility helpers
 */

export const formatDate = (dateString) => {
  if (!dateString) return 'Recent';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateString;
  }
};

export const getExcerpt = (text, maxLength = 140) => {
  if (!text) return '';
  const clean = text.replace(/[\r\n]+/g, ' ').trim();
  if (clean.length <= maxLength) return clean;
  return clean.substring(0, maxLength).trim() + '...';
};

export const calculateReadTime = (content) => {
  if (!content) return '1 min read';
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
};
