/*
 * Live device location for the buyer shop photo. Every call asks the device for a fresh fix (maximumAge: 0):
 * a remembered or cached position is never used, so the location always belongs to the moment of the photo.
 */

export const LOCATION_MESSAGES = {
  unsupported: 'This browser cannot share your location. Please use a recent version of Chrome, Edge or Safari.',
  insecure: 'Location and camera need a secure (https) connection. Please open TradeExpress over https.',
  denied: 'Location access is blocked. Allow location for this site in your browser settings, then take the photo again.',
  unavailable: 'Your live location could not be found. Turn on location (GPS) on your device and try again.',
  timeout: 'Getting your live location took too long. Move to an open area or turn on GPS, then try again.',
};

/** 'granted' | 'prompt' | 'denied' | 'unknown' (some browsers cannot report it). */
export async function locationPermissionState() {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' });
    return status?.state || 'unknown';
  } catch {
    return 'unknown';
  }
}

const toFix = (position) => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
  capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
});

const errorMessage = (error) => LOCATION_MESSAGES[error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable'];

/**
 * Follows the live position while the camera is open: onFix gets every fresh fix (never a cached one), onError a
 * message ready to show. Returns a function that stops watching.
 */
export function watchLiveLocation(onFix, onError) {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    onError(LOCATION_MESSAGES.insecure);
    return () => {};
  }
  if (!navigator.geolocation) {
    onError(LOCATION_MESSAGES.unsupported);
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    (position) => onFix(toFix(position)),
    (error) => onError(errorMessage(error)),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}

/**
 * A fresh position: { latitude, longitude, accuracy, capturedAt }. Rejects with an Error whose message is ready to show.
 * The browser asks for permission when it has not been given yet.
 */
export function getLiveLocation({ timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject(new Error(LOCATION_MESSAGES.insecure));
      return;
    }
    if (!navigator.geolocation) {
      reject(new Error(LOCATION_MESSAGES.unsupported));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        capturedAt: new Date(position.timestamp || Date.now()).toISOString(),
      }),
      (error) => {
        const key = error?.code === 1 ? 'denied' : error?.code === 3 ? 'timeout' : 'unavailable';
        reject(new Error(LOCATION_MESSAGES[key]));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout },
    );
  });
}
