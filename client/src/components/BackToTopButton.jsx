import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const SHOW_AFTER_PX = 400; // reveal once the reader has scrolled roughly half a screen

/**
 * Floating "Back to top" button.
 *
 *  - Hidden near the top of the page, shown after SHOW_AFTER_PX of scrolling.
 *  - While hidden it uses `visibility: hidden`, so it is also out of the tab order and
 *    invisible to screen readers.
 *  - Smooth-scrolls to the top unless the user prefers reduced motion.
 *  - Sits bottom-right, respects the iOS/Android safe area, and uses z-40 so it stays below
 *    modals (z-50) and the reading progress bar.
 */
export const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      // Only touch React state when the button actually has to appear/disappear,
      // so ordinary scrolling causes no re-renders at all.
      const shouldShow = (window.scrollY || window.pageYOffset || 0) > SHOW_AFTER_PX;
      if (shouldShow !== visibleRef.current) {
        visibleRef.current = shouldShow;
        setVisible(shouldShow);
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const handleClick = useCallback(() => {
    const reduceMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });

    // The button hides itself once the page is back at the top. Move the keyboard focus starting
    // point to the top of the document so keyboard users are not left stranded on a hidden control
    // (the next Tab press then reaches the first link in the page header).
    const { body } = document;
    body.setAttribute('tabindex', '-1');
    body.focus({ preventScroll: true });
    body.removeAttribute('tabindex');
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Back to top"
      title="Back to top"
      data-testid="back-to-top"
      className={`fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom))] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 transition-[opacity,transform,visibility,background-color] duration-200 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 motion-reduce:transition-none ${
        visible ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-2 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
};

export default BackToTopButton;
