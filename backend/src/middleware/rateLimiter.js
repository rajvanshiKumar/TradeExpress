import rateLimit from 'express-rate-limit';

const isDev = process.env.NODE_ENV !== 'production';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 500 : 50, // Resilient rate limit for development & testing
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.',
  },
});

// Visual search sends each photo to a paid vision API: keep it to a human browsing pace per IP
export const visualSearchLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: isDev ? 200 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'RATE_LIMITED',
    message: 'Too many image searches. Please wait a few minutes and try again.',
  },
});
