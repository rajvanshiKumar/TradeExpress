/** Longest side sent for visual search: enough detail for recognition, small enough to upload quickly. */
export const MAX_UPLOAD_DIMENSION = 1280;

/** Scales width × height down (never up) so the longest side is at most `max`, keeping the aspect ratio. */
export const fitWithin = (width, height, max = MAX_UPLOAD_DIMENSION) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};
