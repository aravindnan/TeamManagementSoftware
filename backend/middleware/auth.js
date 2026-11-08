const { SignJWT, jwtVerify } = require("jose");
const { prisma } = require("../db/prisma");
const config = require("../config/env");
const { unauthorized } = require("../utils/AppError");
const asyncHandler = require("../utils/asyncHandler");

const cookieOptions = () => ({
  httpOnly: true,
  secure: config.cookieSecure || config.cookieSameSite === "none", // SameSite=None is invalid without Secure
  sameSite: config.cookieSameSite,
  path: "/",
  maxAge: config.jwtExpiresInSeconds * 1000,
});

const secretKey = new TextEncoder().encode(config.jwtSecret);

const signToken = (user) =>
  new SignJWT({ tv: user.tokenVersion || 0 })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${config.jwtExpiresInSeconds}s`)
    .sign(secretKey);

const verifyToken = async (token) => (await jwtVerify(token, secretKey, { algorithms: ["HS256"] })).payload;

const setAuthCookie = async (res, user) => res.cookie(config.cookieName, await signToken(user), cookieOptions());
const clearAuthCookie = (res) => {
  const { maxAge, ...opts } = cookieOptions();
  res.clearCookie(config.cookieName, opts);
};

const extractToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.slice(7);
  return req.cookies?.[config.cookieName] || null;
};

// Requires a valid, non-revoked token. Sets req.user = { id }.
// Sessions slide: if less than a quarter of the lifetime is left, a fresh cookie is issued.
const requireAuth = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw unauthorized("Invalid or expired session");
  }

  const user = await prisma.user.findUnique({ where: { id: String(payload.sub) }, select: { id: true, tokenVersion: true } });
  if (!user || (user.tokenVersion || 0) !== (payload.tv || 0)) throw unauthorized("Invalid or expired session");

  req.user = { id: user.id };

  const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
  if (secondsLeft < config.jwtExpiresInSeconds / 4 && req.cookies?.[config.cookieName]) {
    await setAuthCookie(res, { id: user.id, tokenVersion: user.tokenVersion });
  }
  next();
});

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.setAuthCookie = setAuthCookie;
module.exports.clearAuthCookie = clearAuthCookie;
module.exports.verifyToken = verifyToken;
