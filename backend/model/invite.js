const crypto = require("crypto");
const mongoose = require("mongoose");

const inviteSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  // Only a hash of the secret link token is stored, so a database leak does not leak working invites.
  tokenHash: { type: String, required: true, unique: true },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  revokedAt: { type: Date },
});

inviteSchema.index({ workspace: 1, email: 1 });
inviteSchema.index({ email: 1, acceptedAt: 1, revokedAt: 1 });

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

inviteSchema.statics.hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
/** 256 bits of randomness: unguessable, URL-safe. */
inviteSchema.statics.newToken = () => crypto.randomBytes(32).toString("base64url");
inviteSchema.statics.ttlMs = INVITE_TTL_MS;

inviteSchema.methods.status = function (now = Date.now()) {
  if (this.acceptedAt) return "accepted";
  if (this.revokedAt) return "revoked";
  if (this.expiresAt.getTime() <= now) return "expired";
  return "pending";
};

module.exports = mongoose.model("Invite", inviteSchema);
