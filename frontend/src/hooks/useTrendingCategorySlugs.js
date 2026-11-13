import { useEffect, useState } from 'react';
import { apiGet, isApiConfigured } from '../services/apiClient';

// Shown until the trending list arrives, and if the server cannot be reached
export const FALLBACK_TRENDING_SLUGS = ['electronics', 'fashion-apparel', 'machinery', 'home-kitchen', 'beauty-personal-care', 'furniture'];
const TRENDING_COUNT = 6;

// One request per visit, shared by every page that shows the buttons
let request = null;

function loadTrending() {
  if (!request) {
    request = apiGet(`categories/trending?limit=${TRENDING_COUNT}`)
      .then((res) => {
        const slugs = (res?.data || []).map((item) => item.slug).filter(Boolean);
        return slugs.length ? slugs : FALLBACK_TRENDING_SLUGS;
      })
      .catch(() => {
        request = null; // Try again on the next page
        return FALLBACK_TRENDING_SLUGS;
      });
  }
  return request;
}

/** Slugs of the categories trending on the marketplace right now, most popular first. */
export default function useTrendingCategorySlugs() {
  const [slugs, setSlugs] = useState(FALLBACK_TRENDING_SLUGS);
  useEffect(() => {
    if (!isApiConfigured) return undefined;
    let active = true;
    loadTrending().then((next) => {
      if (active) setSlugs(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return slugs;
}
