import { useEffect, useRef, useState } from 'react';

/**
 * Fades and slides its content in the first time it scrolls into view.
 * Content is visible immediately when IntersectionObserver is missing or motion is reduced.
 */
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!node || reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    // If already in or near viewport, show immediately without waiting
    const rect = node.getBoundingClientRect();
    if (rect.top <= window.innerHeight + 250 && rect.bottom >= -250) {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '250px 0px 250px 0px', threshold: 0.01 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag ref={ref} className={`ts-reveal ${visible ? 'is-visible' : ''} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
