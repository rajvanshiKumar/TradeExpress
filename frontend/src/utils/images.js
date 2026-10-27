// Image helpers.
//
// Real HD photos from Unsplash for all categories and products.
// No cartoon illustrations or placeholders.

const UNSPLASH_CDN = 'https://images.unsplash.com/';

export const FALLBACK_IMAGE = `${UNSPLASH_CDN}photo-1586528116311-ad8dd3c8310d?fm=jpg&fit=crop&w=800&h=800&q=75`;

export const REAL_HD_IMAGES = {
  // Categories
  'category-electronics': 'photo-1498049794561-7780e7231661',
  'category-fashion-apparel': 'photo-1567401893414-76b7b1e5a7a5',
  'category-home-kitchen': 'photo-1600210492493-0946911123ea',
  'category-machinery': 'photo-1566930665082-4ae9dbbb5b6b',
  'beauty-personal-care': 'photo-1522335789203-aabd1fc54bc9',
  'category-beauty-personal-care': 'photo-1522335789203-aabd1fc54bc9',
  'category-packaging': 'photo-1534452203293-494d7ddbf7e0',
  'category-furniture': 'photo-1628744876497-eb30460be9f6',
  'category-automotive': 'photo-1580273916550-e323be2ae537',
  'category-sports-outdoors': 'photo-1575987116913-e96e7d490b8a',
  'category-toys-games': 'photo-1618397360795-952a13220a66',
  'category-agriculture': 'photo-1527847263472-aa5338d178b8',
  'category-industrial-supplies': 'photo-1581092921461-eab62e97a780',

  // Products
  'product-car-mat': 'photo-1649136378672-b965cb9935d5',
  'product-cnc': 'photo-1566930665082-4ae9dbbb5b6b',
  'product-seedling': 'photo-1635574901622-8014a3ddead5',
  'product-drill': 'photo-1562237553-36ad661d6f2c',
  'product-jack': 'photo-1580273916550-e323be2ae537',
  'product-sprayer': 'photo-1549049950-48d5887197a0',
  'product-helmet': 'photo-1581092921461-eab62e97a780',
  'product-wrench': 'photo-1613206485381-b028e578e791',
  'product-carton': 'photo-1513672494107-cd9d848a383e',
  'product-toy-blocks': 'photo-1575364289437-fb1479d52732',
  'product-generic': 'photo-1586528116311-ad8dd3c8310d',

  // Covers
  'cover-industrial': 'photo-1566930665082-4ae9dbbb5b6b',
  'cover-default': 'photo-1586528116311-ad8dd3c8310d',
};

function getBackendOrigin() {
  const rawApi = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_API_BASE_URL) || '';
  if (rawApi) {
    return rawApi.replace(/\/api\/?$/, '');
  }
  if (typeof window !== 'undefined' && window.location) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return window.location.origin;
  }
  return 'http://localhost:5000';
}

export function photoUrl(photoId, width = 800, height = 800, crop = '') {
  if (!photoId) return FALLBACK_IMAGE;

  // Direct absolute URLs or browser object/data URLs
  if (
    photoId.startsWith('http://') ||
    photoId.startsWith('https://') ||
    photoId.startsWith('data:') ||
    photoId.startsWith('blob:')
  ) {
    return photoId;
  }

  // Uploaded backend files
  if (photoId.startsWith('/uploads/') || photoId.startsWith('uploads/') || photoId.startsWith('/api/uploads/')) {
    const origin = getBackendOrigin();
    const cleanPath = photoId.startsWith('/') ? photoId : `/${photoId}`;
    return `${origin}${cleanPath}`;
  }

  // Predefined catalog image key (e.g. 'photo-car-mat' or 'category-electronics')
  if (REAL_HD_IMAGES[photoId]) {
    const realId = REAL_HD_IMAGES[photoId];
    return `${UNSPLASH_CDN}${realId}?fm=jpg&fit=crop&w=${width}&h=${height}&q=75${crop ? `&crop=${crop}` : ''}`;
  }

  // Unsplash photo- ID
  if (photoId.startsWith('photo-')) {
    return `${UNSPLASH_CDN}${photoId}?fm=jpg&fit=crop&w=${width}&h=${height}&q=75${crop ? `&crop=${crop}` : ''}`;
  }

  // File path with extension or slash (e.g. uploaded images or relative paths)
  if (photoId.includes('/') || /\.(jpe?g|png|webp|svg|gif)$/i.test(photoId)) {
    const origin = getBackendOrigin();
    const cleanPath = photoId.startsWith('/') ? photoId : `/uploads/${photoId}`;
    return `${origin}${cleanPath}`;
  }

  return `${UNSPLASH_CDN}${photoId}?fm=jpg&fit=crop&w=${width}&h=${height}&q=75${crop ? `&crop=${crop}` : ''}`;
}

export const illustrationUrl = (name) => {
  if (!name) return FALLBACK_IMAGE;
  if (
    name.startsWith('http://') ||
    name.startsWith('https://') ||
    name.startsWith('data:') ||
    name.startsWith('blob:') ||
    name.startsWith('/uploads/') ||
    name.startsWith('uploads/') ||
    name.startsWith('/api/uploads/')
  ) {
    return photoUrl(name);
  }
  if (REAL_HD_IMAGES[name]) {
    return photoUrl(REAL_HD_IMAGES[name]);
  }
  if (name.startsWith('photo-')) {
    return photoUrl(name);
  }
  return FALLBACK_IMAGE;
};

/** { src, fallback } for a record that has an optional `photo` ID and an `illustration` name. */
export function resolveImage(record = {}, width = 800, height = 800, crop = '') {
  const { photo, illustration, category } = record;
  let resolvedId = photo;
  if (!resolvedId && illustration) {
    if (
      illustration.startsWith('http://') ||
      illustration.startsWith('https://') ||
      illustration.startsWith('data:') ||
      illustration.startsWith('blob:') ||
      illustration.startsWith('/uploads/') ||
      illustration.startsWith('uploads/') ||
      illustration.startsWith('/api/uploads/') ||
      illustration.startsWith('photo-') ||
      REAL_HD_IMAGES[illustration]
    ) {
      resolvedId = REAL_HD_IMAGES[illustration] || illustration;
    }
  }
  if (!resolvedId && category) {
    resolvedId = REAL_HD_IMAGES[`category-${category}`];
  }
  const fallback = illustrationUrl(illustration);
  return {
    src: resolvedId ? photoUrl(resolvedId, width, height, crop) : fallback,
    fallback,
  };
}
