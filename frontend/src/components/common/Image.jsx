import { useEffect, useState } from 'react';
import { FALLBACK_IMAGE, resolveImage } from '../../utils/images';

/**
 * Image with a safety net. It shows the Unsplash photo when one is set, falls back to
 * the record's local illustration if the photo fails, and finally to a generic placeholder.
 * Pass either `photo`/`illustration` (from a data record) or a plain `src`.
 */
export default function Image({ photo, illustration, category, src, width = 800, height = 800, crop = '', alt, className = '', eager = false, ...rest }) {
  const resolved = src ? { src, fallback: FALLBACK_IMAGE } : resolveImage({ photo, illustration, category }, width, height, crop);
  const [current, setCurrent] = useState(resolved.src);

  useEffect(() => {
    setCurrent(resolved.src);
  }, [resolved.src]);

  const handleError = () => {
    if (current !== FALLBACK_IMAGE) {
      setCurrent(FALLBACK_IMAGE);
    }
  };

  return (
    <img
      src={current} alt={alt} width={width} height={height} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={handleError} className={className} {...rest}
    />
  );
}
