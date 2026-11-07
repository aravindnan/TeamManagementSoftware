const express = require("express");
const rateLimit = require("express-rate-limit");
const c = require("../controller/authController");
const validate = require("../middleware/validate");
const requireAuth = require("../middleware/auth");
const s = require("../schemas");
const { isTest } = require("../config/env");

const router = express.Router();

// Brute-force protection on credential endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: "Too many attempts, please try again later" },
});

router.post("/register", authLimiter, validate({ body: s.register }), c.register);
router.post("/login", authLimiter, validate({ body: s.login }), c.login);
router.post("/logout", c.logout);
router.get("/me", requireAuth, c.me);

module.exports = router;
