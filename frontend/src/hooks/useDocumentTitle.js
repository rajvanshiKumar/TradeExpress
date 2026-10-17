import { useEffect } from 'react';
import { BRAND } from '../utils/constants';

/** Sets the browser tab title, e.g. "Products | TradeSphere". */
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND.name}` : `${BRAND.name} — ${BRAND.tagline}`;
  }, [title]);
}
