const { isProd, isTest } = require("../config/env");

const notFoundHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  let status = err.status || 500;
  let message = err.message;

  if (err.name === "CastError") { status = 400; message = "Invalid id"; }
  else if (err.name === "ValidationError") { status = 400; }
  else if (err.code === "P2002") {
    // Unique constraint (Prisma): meta.target lists the columns.
    status = 409;
    const field = [].concat(err.meta?.target || [])[0] || "value";
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  } else if (err.code === "P2003") {
    status = 409;
    message = "A related record no longer exists";
  } else if (err.type === "entity.too.large") { status = 413; message = "Payload too large"; }
  else if (err.type === "entity.parse.failed") { status = 400; message = "Malformed JSON"; }

  if (status >= 500) {
    if (!isTest) console.error(`[${req.method} ${req.originalUrl}]`, err);
    if (isProd) message = "Internal Server Error";
  }

  res.status(status).json({ error: message || "Internal Server Error", ...(err.extra || {}) });
};

module.exports = { notFoundHandler, errorHandler };
