// Central, validated configuration. Fails fast at startup if anything required is missing.
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
// Tests must never pick up real credentials from a developer's .env.
if (!isTest) require("dotenv").config();

const required = (name) => {
  const value = process.env[name];
  if (!value && !isTest) {
    throw new Error(`Missing required environment variable: ${name} (see backend/.env.example)`);
  }
  return value;
};

const jwtSecret = required("JWT_SECRET") || "test-secret-test-secret-test-secret-0123456789";
if (!isTest && jwtSecret.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long");
}

module.exports = {
  isProd,
  isTest,
  port: Number(process.env.PORT) || 8000,
  mongoUri: isTest ? process.env.MONGO_URI : buildMongoUri(),
  jwtSecret,
  jwtExpiresInSeconds: 8 * 60 * 60, // sessions slide: see middleware/auth.js
  cookieName: "tms_token",
  cookieSameSite: process.env.COOKIE_SAMESITE || "lax", // use "none" only for cross-site deployments (requires HTTPS)
  // Secure cookies need HTTPS. Defaults to on in production; set COOKIE_SECURE=false only for plain-HTTP local runs.
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : isProd,
  clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Google sign-in: the OAuth client ID from Google Cloud Console (no secret needed for ID-token verification).
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  // Where the web app lives; used to build the invite links people receive.
  publicClientUrl: (process.env.PUBLIC_CLIENT_URL || (process.env.CLIENT_ORIGINS || "http://localhost:3000").split(",")[0]).trim().replace(/\/$/, ""),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUDNAME,
    apiKey: process.env.CLOUDINARY_APIKEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
    folder: process.env.CLOUDINARY_FOLDER || "tms",
  },
};

function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const user = required("DB_USERNAME");
  const pass = required("DB_PASSWORD");
  const name = required("DB_NAME");
  const host = process.env.DB_HOST || "cluster0.myusfay.mongodb.net";
  return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}/${name}?retryWrites=true&w=majority`;
}
