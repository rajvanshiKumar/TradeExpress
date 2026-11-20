import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Scroll position on page changes:
 * - a new page starts at the top (or at the #hash target when the URL has one);
 * - Back and Forward return to exactly where the reader was on that page, instantly.
 * Filter changes that keep the same page (only the ?query changes) leave the position alone.
 */
/** The portal a path belongs to ('buyer' | 'supplier'), or null for the rest of the site. */
const portalOf = (path) => /^\/(buyer|supplier)(\/|$)/.exec(path || '')?.[1] || null;

export default function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const positions = useRef(new Map());
  const currentKey = useRef(key);
  const lastPath = useRef(pathname);

  // The browser's own restoration would scroll the old page, then this component would jump again
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
  }, []);

  // Remembers where the reader is on each history entry
  useEffect(() => {
    let frame = 0;
    const save = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        positions.current.set(currentKey.current, window.scrollY);
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return () => {
      window.removeEventListener('scroll', save);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    currentKey.current = key;
    const pageChanged = lastPath.current !== pathname;
    const previousPath = lastPath.current;
    lastPath.current = pathname;

    if (hash) {
      const timer = window.setTimeout(
        () => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
        60,
      );
      return () => window.clearTimeout(timer);
    }

    const saved = navigationType === 'POP' ? positions.current.get(key) : undefined;
    if (saved !== undefined) {
      // Back/Forward: wait until the page is tall enough to hold the old position, for up to about a second
      let tries = 0;
      let frame = 0;
      const restore = () => {
        const reachable = document.documentElement.scrollHeight - window.innerHeight >= saved - 1;
        if (reachable || tries >= 60) {
          window.scrollTo({ top: saved, left: 0, behavior: 'instant' });
          return;
        }
        tries += 1;
        frame = window.requestAnimationFrame(restore);
      };
      frame = window.requestAnimationFrame(restore);
      return () => window.cancelAnimationFrame(frame);
    }

    if (!pageChanged) return undefined;
    // Inside a portal (buyer / supplier), moving between its pages keeps the site header and sidebar where
    // they are: the window only goes back to the start of the content, never to the very top of the site
    const portal = portalOf(pathname);
    const main = portal && portal === portalOf(previousPath) ? document.getElementById('main') : null;
    if (main) {
      const header = document.querySelector('header');
      const contentTop = Math.max(0, main.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight || 0) - 16);
      if (window.scrollY > contentTop) window.scrollTo({ top: contentTop, left: 0, behavior: 'instant' });
      return undefined;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    return undefined;
  }, [pathname, hash, key, navigationType]);

  return null;
}
