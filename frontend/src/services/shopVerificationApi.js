import { apiUrl } from '../config/api.js';

/* Buyer signup Step 4: upload the live shop photo and look up the address of the live location. */

async function readJson(res) {
  return res.json().catch(() => ({}));
}

/** Uploads the captured JPEG. Returns { url, fileUrl } of the stored photo. */
export async function uploadShopPhoto(blob) {
  const form = new FormData();
  form.append('file', blob, `shop-photo-${Date.now()}.jpg`);
  let res;
  try {
    res = await fetch(apiUrl('/upload'), { method: 'POST', body: form, signal: AbortSignal.timeout(60000) });
  } catch {
    throw new Error('The shop photo could not be uploaded. Please check your connection and try again.');
  }
  const data = await readJson(res);
  if (!res.ok || !data.success || !(data.fileUrl || data.data?.fileUrl)) {
    throw new Error(data.message || 'The shop photo could not be uploaded. Please try again.');
  }
  return { url: data.url || data.data?.url, fileUrl: data.fileUrl || data.data.fileUrl };
}

/** Address of a live position, or null when it cannot be found (the coordinates are still kept). */
export async function lookupAddress(latitude, longitude) {
  try {
    const res = await fetch(apiUrl('/verification/location/reverse-geocode'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ latitude, longitude }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await readJson(res);
    return res.ok && data.success ? data.data?.address || null : null;
  } catch {
    return null;
  }
}
