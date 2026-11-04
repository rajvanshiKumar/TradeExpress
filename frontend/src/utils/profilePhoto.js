// Prepares a supplier's photograph in the browser: checks the file, crops it to the ID card's 3:4 frame and saves it as a
// JPEG. All accepted formats, including WebP, therefore reach the server in a form the PDF can embed.

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');
export const MAX_PHOTO_FILE_MB = 5;
const MIN_SIDE = 200;
const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 960;

/** Returns an error message for a file that cannot be used, or '' when it is fine. */
export function photoFileError(file) {
  if (!file) return 'Please choose a photograph.';
  if (!PHOTO_TYPES.includes(file.type)) return 'Please upload a JPG, JPEG, PNG or WebP photograph.';
  if (file.size > MAX_PHOTO_FILE_MB * 1024 * 1024) return `The photograph must be smaller than ${MAX_PHOTO_FILE_MB} MB.`;
  return '';
}

/** Resolves to a JPEG data URL, or rejects with a readable message. */
export function prepareProfilePhoto(file) {
  const problem = photoFileError(file);
  if (problem) return Promise.reject(new Error(problem));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (image.naturalWidth < MIN_SIDE || image.naturalHeight < MIN_SIDE) {
        reject(new Error(`The photograph is too small. Please use one at least ${MIN_SIDE} x ${MIN_SIDE} pixels.`));
        return;
      }
      const scale = Math.max(OUTPUT_WIDTH / image.naturalWidth, OUTPUT_HEIGHT / image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      context.drawImage(image, (OUTPUT_WIDTH - width) / 2, (OUTPUT_HEIGHT - height) / 2, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file could not be read as an image. Please choose another photograph.'));
    };
    image.src = url;
  });
}

/** Saves a downloaded file on desktop and mobile. */
export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some mobile browsers start the download late, so the file stays available for a while
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
