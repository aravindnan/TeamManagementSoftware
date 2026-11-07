const crypto = require("crypto");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");

// Issues a short-lived Cloudinary upload signature so the browser never holds the API secret
// and cannot upload outside our folder. See https://cloudinary.com/documentation/authentication_signatures
exports.sign = asyncHandler(async (_req, res) => {
  const { cloudName, apiKey, apiSecret, folder } = config.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) throw new AppError(503, "File uploads are not configured");

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");
  res.status(200).json({ cloudName, apiKey, folder, timestamp, signature });
});
