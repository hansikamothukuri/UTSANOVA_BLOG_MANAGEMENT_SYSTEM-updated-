/**
 * Reading-progress maths, kept free of React/DOM so it can be unit tested.
 *
 * All positions are in document coordinates (px from the top of the page).
 *
 *  - Long article (taller than the viewport): 0% when the article's top reaches the top of the
 *    viewport, 100% when the article's bottom reaches the bottom of the viewport.
 *  - Short article (fits inside one viewport): 0% at the top of the page, 100% once the end of the
 *    article has scrolled into the upper quarter of the viewport. (Measuring from the article's
 *    top would show a full bar before the reader has scrolled at all.)
 *  - The end point is never beyond the page's maximum scroll position, so 100% is always reachable.
 *  - The result is always clamped to the range 0..1.
 */
export const SHORT_ARTICLE_READING_LINE = 0.25;

export const clamp01 = (n) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export const computeReadingProgress = ({
  contentTop,
  contentHeight,
  scrollY,
  viewportHeight,
  maxScroll = Infinity,
}) => {
  if (!(contentHeight > 0) || !(viewportHeight > 0)) return 0;

  const contentBottom = contentTop + contentHeight;
  let start;
  let end;
  if (contentHeight > viewportHeight) {
    start = contentTop;
    end = contentBottom - viewportHeight;
  } else {
    start = 0;
    end = contentBottom - viewportHeight * SHORT_ARTICLE_READING_LINE;
  }
  if (Number.isFinite(maxScroll) && maxScroll >= 0) end = Math.min(end, maxScroll);

  if (end <= start) return scrollY > start ? 1 : 0; // nothing to scroll through
  return clamp01((scrollY - start) / (end - start));
};
