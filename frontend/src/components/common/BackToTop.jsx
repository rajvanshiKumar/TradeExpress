import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Floating "Back to Top" button in the bottom-right corner.
 * Appears when user scrolls down and smoothly returns to the top on click.
 */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // Show when scrolled down more than 300px
      if (window.scrollY > 300) {
        setVisible(true);
      } else {
        setVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    toggleVisibility(); // Check initial scroll position

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <button
      type="button"
      id="back-to-top-button"
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to Top"
      className={`fixed bottom-6 right-4 sm:bottom-8 sm:right-8 z-50 flex items-center gap-2 rounded-full bg-navy-950/95 hover:bg-brand-600 text-white px-3.5 py-2.5 sm:px-4 sm:py-2.5 shadow-2xl hover:shadow-brand-500/30 border border-white/15 hover:border-brand-400/50 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 active:translate-y-0 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto scale-100'
          : 'opacity-0 translate-y-4 pointer-events-none scale-90'
      }`}
    >
      <span className="flex size-6 items-center justify-center rounded-full bg-brand-500/25 text-brand-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
        <ArrowUp className="size-3.5 sm:size-4 group-hover:-translate-y-0.5 transition-transform duration-200" aria-hidden="true" />
      </span>
      <span className="text-xs font-extrabold tracking-tight select-none pr-1">
        Back to Top
      </span>
    </button>
  );
}
