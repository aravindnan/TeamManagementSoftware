const { prisma } = require("../db/prisma");
const S = require("../db/serialize");
const asyncHandler = require("../utils/asyncHandler");
const { notFound } = require("../utils/AppError");

// Everything here is scoped to req.user: one person can never see or change another's inbox.

exports.list = asyncHandler(async (req, res) => {
  const { before, unread, limit } = req.query;
  const where = { userId: req.user.id };
  if (unread === "true") where.readAt = null;
  if (before) where.id = { lt: before };

  const rows = await prisma.notification.findMany({ where, orderBy: { id: "desc" }, take: limit + 1 });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const unreadCount = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.status(200).json({ items: items.map(S.notification), nextCursor: hasMore ? items[items.length - 1].id : null, unreadCount });
});

exports.unreadCount = asyncHandler(async (req, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user.id, readAt: null } });
  res.status(200).json({ count });
});

exports.markRead = asyncHandler(async (req, res) => {
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.notificationId, userId: req.user.id },
    data: { readAt: new Date() },
  });
  if (!count) throw notFound("Notification not found");
  res.status(200).json({ ok: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  const result = await prisma.notification.updateMany({ where: { userId: req.user.id, readAt: null }, data: { readAt: new Date() } });
  res.status(200).json({ ok: true, updated: result.count });
});
