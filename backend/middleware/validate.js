const { AppError } = require("../utils/AppError");

// validate({ body, params, query }) with zod schemas. Parsed values replace the originals,
// so unknown keys are stripped (schemas are non-passthrough by default).
const validate = (schemas) => (req, _res, next) => {
  for (const part of ["params", "query", "body"]) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part]);
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return next(new AppError(400, issues[0] ? `${issues[0].field ? issues[0].field + ": " : ""}${issues[0].message}` : "Invalid request", { issues }));
    }
    if (part === "query") {
      Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true });
    } else {
      req[part] = result.data;
    }
  }
  next();
};

module.exports = validate;
