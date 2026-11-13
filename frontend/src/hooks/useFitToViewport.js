import { useEffect, useRef } from 'react';

/**
 * Keeps a sticky panel inside the visible screen: its height is the space between its top (or `stickTop` once it sticks)
 * and the bottom of the window, so a bottom bar inside it is always on screen. Updated once per frame while scrolling.
 * The panel's column should have a fixed minimum height, so the changing height never moves the page layout.
 */
export default function useFitToViewport({ stickTop = 96, gap = 16, maxHeight = 928 } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    let frame = 0;
    const fit = () => {
      frame = 0;
      const el = ref.current;
      if (!el || !el.offsetParent) return;
      const top = Math.max(el.parentElement.getBoundingClientRect().top, stickTop);
      const height = Math.round(Math.min(Math.max(window.innerHeight - top - gap, 320), maxHeight));
      if (el.style.height !== `${height}px`) el.style.height = `${height}px`;
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(fit);
    };
    fit();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.cancelAnimationFrame(frame);
    };
  }, [stickTop, gap, maxHeight]);
  return ref;
}
