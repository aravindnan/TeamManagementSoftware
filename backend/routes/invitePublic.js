const express = require("express");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const c = require("../controller/workspaceController");
const validate = require("../middleware/validate");
const { isTest } = require("../config/env");

const router = express.Router();

// Public (the landing page runs before sign-in), so it is rate limited. Tokens are 256-bit, so guessing is
// hopeless anyway; this just stops it being used as a free lookup service.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: "Too many requests, please try again later" },
});

router.get("/invites/preview/:token", limiter, validate({ params: z.object({ token: z.string().min(20).max(200) }) }), c.previewInvite);

module.exports = router;
