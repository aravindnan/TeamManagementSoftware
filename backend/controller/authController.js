const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const User = require("../model/user");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { setAuthCookie, clearAuthCookie, verifyToken } = require("../middleware/auth");
const { getFullProfile } = require("./userController");
const { verifier } = require("../utils/googleVerifier");

// Used to keep login timing similar whether or not the username exists.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

exports.register = asyncHandler(async (req, res) => {
  const { username, email, password, firstName, lastName, role, dateOfBirth } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  await User.create({ username, email, password: hashed, firstName, lastName, role, dateOfBirth });
  res.status(201).json({ message: "User registered successfully", registerSuccess: true });
});

exports.login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ $or: [{ username }, { email: username.toLowerCase() }] }).select("+password +tokenVersion");
  const ok = await bcrypt.compare(password, user ? user.password : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, "Invalid credentials", { success: false });

  user.lastLoginDate = new Date();
  await user.save();
  await setAuthCookie(res, user);
  res.status(200).json({ success: true, loginStatus: true, message: "Login Successful", userId: user._id });
});

// Public on purpose: a logged-out client can always clear its cookie. Revokes all tokens if one was valid.
exports.logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.cookieName] || (req.headers.authorization || "").replace(/^Bearer /, "");
  if (token) {
    try {
      const { sub } = await verifyToken(token);
      await User.updateOne({ _id: sub }, { $inc: { tokenVersion: 1 } });
    } catch {
      /* expired/invalid token: nothing to revoke */
    }
  }
  clearAuthCookie(res);
  res.status(200).json({ message: "Logout successful", logoutStatus: true });
});

// Source of truth for "who am I" (the token itself is httpOnly and unreadable by JS).
exports.me = asyncHandler(async (req, res) => {
  const profile = await getFullProfile(req.user.id);
  if (!profile) throw new AppError(404, "User not found");
  res.status(200).json(profile);
});

// ---------------------------------------------------------------- Google sign-in / sign-up

const unusablePassword = () => bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

/** A free username derived from the email's local part: "ann.lee@x.com" -> "ann.lee", then "ann.lee2"... */
async function freeUsername(email) {
  const base = (email.split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "") || "user").slice(0, 24).padEnd(3, "0");
  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}${crypto.randomInt(10, 9999)}`;
    if (!(await User.exists({ username: candidate }))) return candidate;
  }
  return `${base}${crypto.randomBytes(4).toString("hex")}`;
}

exports.google = asyncHandler(async (req, res) => {
  const profile = await verifier.verify(req.body.credential);

  let isNewUser = false;
  let user = await User.findOne({ googleId: profile.googleId }).select("+tokenVersion");

  if (!user) {
    user = await User.findOne({ email: profile.email }).select("+tokenVersion +password");
    if (user) {
      // An account with this email already exists. Google has proven the address is theirs, so link it.
      // But if that account was never verified, someone else may have registered the address first (and
      // chosen the password). Cut them out: the password stops working and every existing session ends.
      if (!user.emailVerified) {
        user.password = await unusablePassword();
        user.tokenVersion = (user.tokenVersion || 0) + 1;
      }
      user.googleId = profile.googleId;
      user.emailVerified = true;
      if (!user.profilePictureURL && profile.picture) user.profilePictureURL = profile.picture;
    } else {
      isNewUser = true;
      user = new User({
        username: await freeUsername(profile.email),
        email: profile.email,
        password: await unusablePassword(), // password sign-in is simply impossible until they set one
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: "Member",
        googleId: profile.googleId,
        emailVerified: true,
        profilePictureURL: profile.picture,
      });
    }
  }

  user.lastLoginDate = new Date();
  try {
    await user.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, "That account could not be created, please try again");
    throw err;
  }
  await setAuthCookie(res, user);
  res.status(200).json({
    success: true,
    loginStatus: true,
    message: isNewUser ? "Account created" : "Login Successful",
    userId: user._id,
    isNewUser,
  });
});
