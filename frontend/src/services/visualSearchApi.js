import { apiPost } from './apiClient';
import { fitWithin } from '../utils/imageResize';

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Re-encodes the photo as a JPEG of at most 1280px (respecting the camera orientation), so large phone photos
 * upload fast and stay under the server's 5 MB limit. Falls back to the original file when the browser cannot decode it.
 */
export async function prepareSearchImage(file) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff'; // transparent PNGs become white, not black, as JPEG
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'search.jpg', { type: 'image/jpeg' }) : file;
  } finally {
    bitmap.close?.();
  }
}

/**
 * Finds catalogue products that match the product in a photo.
 * Resolves { recognized, matchType: 'product' | 'category' | 'none', products };
 * rejects with { code, message } (code: VISUAL_SEARCH_UNAVAILABLE, INVALID_IMAGE, RATE_LIMITED, ...).
 */
export async function searchProductsByImage(file, { signal } = {}) {
  const image = await prepareSearchImage(file);
  if (!SUPPORTED_TYPES.includes(image.type)) {
    throw { code: 'INVALID_IMAGE', message: 'This image format is not supported. Please upload a JPG, PNG or WEBP photo.' };
  }
  const form = new FormData();
  form.append('image', image, image.name || 'search.jpg');
  try {
    const response = await apiPost('products/visual-search', form, { signal, timeoutMs: 45000 });
    return response?.data || { recognized: null, matchType: 'none', products: [] };
  } catch (error) {
    if (error?.name === 'AbortError' || signal?.aborted) throw { code: 'ABORTED', message: 'Search cancelled.' };
    const code = error?.data?.code || (error?.status === 429 ? 'RATE_LIMITED' : error?.status === 0 ? 'NETWORK' : 'VISUAL_SEARCH_FAILED');
    const message = error?.status === 0
      ? 'We could not reach the server. Check your connection and try again.'
      : error?.data?.message || error?.message || 'Visual search failed. Please try again.';
    throw { code, message };
  }
}
