const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const config = require("./config/env");
const requireAuth = require("./middleware/auth");
const { notFoundHandler, errorHandler } = require("./middleware/error");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / curl / server-to-server requests have no Origin header.
        if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok" }));

  // Public: register, login, logout (+ /me which guards itself)
  app.use("/", require("./routes/auth"));

  // Everything below requires an authenticated, non-revoked session.
  app.use(requireAuth);
  app.use("/", require("./routes/user"));
  app.use("/", require("./routes/project"));
  app.use("/", require("./routes/task"));
  app.use("/", require("./routes/upload"));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
