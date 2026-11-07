const Notification = require("../model/notification");
const asyncHandler = require("../utils/asyncHandler");
const { notFound } = require("../utils/AppError");

// Everything here is scoped to req.user: one person can never see or change another's inbox.

exports.list = asyncHandler(async (req, res) => {
  const { before, unread, limit } = req.query;
  const filter = { user: req.user.id };
  if (unread === "true") filter.readAt = { $exists: false };
  if (before) filter._id = { $lt: before };

  const rows = await Notification.find(filter).sort({ _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const unreadCount = await Notification.countDocuments({ user: req.user.id, readAt: { $exists: false } });
  res.status(200).json({ items, nextCursor: hasMore ? String(items[items.length - 1]._id) : null, unreadCount });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user.id, readAt: { $exists: false } });
  res.status(200).json({ count });
});

exports.markRead = asyncHandler(async (req, res) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: req.params.notificationId, user: req.user.id },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
  if (!updated) throw notFound("Notification not found");
  res.status(200).json({ ok: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: req.user.id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.status(200).json({ ok: true, updated: result.modifiedCount });
});
