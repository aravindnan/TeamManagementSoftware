const { createRemoteJWKSet, jwtVerify } = require("jose");
const config = require("../config/env");
const { AppError, unauthorized } = require("./AppError");

// Google publishes its signing keys here; `jose` fetches and caches them and handles key rotation.
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/**
 * Verifies a Google Identity Services ID token ("credential") and returns the profile it vouches for.
 * Checks the RS256 signature against Google's keys, the issuer, that the token was minted for OUR client id
 * (audience), and expiry. Throws a 401 for anything else, and a 503 when Google sign-in isn't configured.
 *
 * `clientId` and `jwks` are injectable so tests can use locally signed tokens.
 */
async function verifyGoogleIdToken(credential, { clientId = config.googleClientId, jwks = GOOGLE_JWKS } = {}) {
  if (!clientId) throw new AppError(503, "Google sign-in is not configured");

  let payload;
  try {
    ({ payload } = await jwtVerify(credential, jwks, { issuer: GOOGLE_ISSUERS, audience: clientId, algorithms: ["RS256"] }));
  } catch {
    throw unauthorized("Invalid Google credential");
  }

  // Only trust an address Google has verified, otherwise anyone could claim someone else's email.
  const verified = payload.email_verified === true || payload.email_verified === "true";
  if (!payload.sub || !payload.email || !verified) throw unauthorized("Your Google email address is not verified");

  const fullName = String(payload.name || "").trim();
  return {
    googleId: String(payload.sub),
    email: String(payload.email).toLowerCase(),
    firstName: String(payload.given_name || fullName.split(/\s+/)[0] || "User").slice(0, 60),
    lastName: String(payload.family_name || fullName.split(/\s+/).slice(1).join(" ") || "").slice(0, 60),
    picture: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : "",
  };
}

// Indirection so the controller can be tested without Google's keys.
const verifier = { verify: (credential) => verifyGoogleIdToken(credential) };

module.exports = { verifyGoogleIdToken, verifier };
