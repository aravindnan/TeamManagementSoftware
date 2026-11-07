class AppError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}
const badRequest = (m, e) => new AppError(400, m, e);
const unauthorized = (m = "Authentication required") => new AppError(401, m);
const forbidden = (m = "You do not have permission to do that") => new AppError(403, m);
const notFound = (m = "Not found") => new AppError(404, m);
const conflict = (m) => new AppError(409, m);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict };
