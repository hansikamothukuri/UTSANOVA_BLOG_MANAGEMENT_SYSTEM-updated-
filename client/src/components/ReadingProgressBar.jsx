import React, { useEffect, useRef } from 'react';
import { computeReadingProgress } from '../utils/readingProgress.js';

/**
 * Thin reading-progress bar fixed to the top of the screen.
 *
 * `targetRef` points at the article's content area, so progress is measured over the article
 * itself (not the header, comments or "more posts" sections).
 *
 * Performance: the bar is updated by writing a CSS transform directly to the DOM node, so
 * scrolling never triggers a React re-render. Updates are coalesced to one per animation frame,
 * the scroll listener is passive, and everything is removed again on unmount.
 */
export const ReadingProgressBar = ({ targetRef }) => {
  const barRef = useRef(null);

  useEffect(() => {
    const target = targetRef?.current;
    const bar = barRef.current;
    if (!target || !bar) return undefined;

    let frame = 0;
    let lastValue = -1;

    const update = () => {
      frame = 0;
      const root = document.documentElement;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const viewportHeight = root.clientHeight || window.innerHeight;
      const rect = target.getBoundingClientRect();

      const progress = computeReadingProgress({
        contentTop: rect.top + scrollY,
        contentHeight: rect.height,
        scrollY,
        viewportHeight,
        maxScroll: root.scrollHeight - viewportHeight,
      });

      if (progress !== lastValue) {
        lastValue = progress;
        bar.style.transform = `scaleX(${progress})`;
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // Article height changes after first paint (images loading, fonts, content swaps)
    let observer = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      observer.observe(target);
      observer.observe(document.body);
    }

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (observer) observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [targetRef]);

  return (
    <div
      aria-hidden="true"
      data-testid="reading-progress"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-500 will-change-transform"
        style={{ transform: 'scaleX(0)' }}
      />
    </div>
  );
};

export default ReadingProgressBar;
