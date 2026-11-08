const crypto = require("crypto");

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Only a hash of the secret link token is stored, so a database leak does not leak working invites.
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
/** 256 bits of randomness: unguessable, URL-safe. */
const newToken = () => crypto.randomBytes(32).toString("base64url");

/** "accepted" | "revoked" | "expired" | "pending" for an invite row. */
const inviteStatus = (invite, now = Date.now()) => {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  if (invite.expiresAt.getTime() <= now) return "expired";
  return "pending";
};

/** Prisma `where` for invitations that can still be accepted. */
const pendingWhere = (extra = {}) => ({ acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() }, ...extra });

module.exports = { INVITE_TTL_MS, hashToken, newToken, inviteStatus, pendingWhere };
