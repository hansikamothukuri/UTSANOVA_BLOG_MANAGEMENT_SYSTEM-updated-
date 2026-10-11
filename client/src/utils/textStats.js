/**
 * Text statistics for the blog editor's live character / word counters.
 *
 * Counts are of the raw text exactly as typed (Markdown syntax included), which matches how
 * calculateReadTime() in formatDate.js counts words.
 */

/** Number of characters (Unicode code points, so an emoji counts as 1). Spaces/newlines count. */
export const countCharacters = (text) => {
  if (typeof text !== 'string' || text.length === 0) return 0;
  let count = 0;
  // for...of iterates by code point and allocates nothing (cheap on every keystroke)
  // eslint-disable-next-line no-unused-vars
  for (const _ of text) count += 1;
  return count;
};

/**
 * Number of words: runs of non-whitespace characters. Repeated spaces, tabs, line breaks and
 * non-breaking spaces never create extra words, and empty / whitespace-only text is 0 words.
 */
export const countWords = (text) => {
  if (typeof text !== 'string' || text.length === 0) return 0;
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
};

export const getTextStats = (text) => ({
  characters: countCharacters(text),
  words: countWords(text),
});
