const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    // Never returned unless explicitly selected (login only).
    password: { type: String, required: true, select: false },
    // Google account id ("sub"). Never returned by the API.
    googleId: { type: String, unique: true, sparse: true, select: false },
    // True once we know the person controls the address (Google says so). Password sign-ups start unverified.
    emailVerified: { type: Boolean, default: false },
    // Bumped on logout / password change to revoke every issued token.
    tokenVersion: { type: Number, default: 0, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: "" },
    role: { type: String, trim: true },
    dateOfBirth: { type: String },
    lastLoginDate: { type: Date },
    allTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    myProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    involvedProjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Project" }],
    profilePictureURL: { type: String, default: "" },
    bio: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
