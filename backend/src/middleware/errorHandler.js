export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `API Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, next) {
  console.error('[TradeExpress API Error]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
  });

  const statusCode = err.statusCode || err.status || (res.statusCode === 200 ? 500 : res.statusCode);
  // Database errors, and unexpected errors in production, are logged above but never sent to the browser:
  // their text can reveal table, column and query details. Errors a service raised on purpose (with their own
  // status code, e.g. 502 "We could not send the verification email") keep their message.
  const isDatabaseError = /^PrismaClient/.test(err?.name || '');
  const isUnexpected = !err?.statusCode && !err?.status;
  const hideDetails = isDatabaseError || (isUnexpected && process.env.NODE_ENV === 'production');
  res.status(statusCode).json({
    success: false,
    message: hideDetails ? 'Something went wrong on our side. Please try again.' : (err.message || 'Internal Server Error'),
    errors: err.errors || undefined,
    code: err.errorCode || undefined,
    cooldownRemaining: err.cooldownRemaining || undefined,
    accountRole: err.accountRole || undefined,
  });
}
