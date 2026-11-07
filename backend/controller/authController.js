const bcrypt = require("bcryptjs");
const User = require("../model/user");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const { AppError } = require("../utils/AppError");
const { setAuthCookie, clearAuthCookie, verifyToken } = require("../middleware/auth");
const { getFullProfile } = require("./userController");

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
