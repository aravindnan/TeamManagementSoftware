const express = require("express");
const c = require("../controller/notificationController");
const validate = require("../middleware/validate");
const s = require("../schemas");

const router = express.Router();

router.get("/notifications", validate({ query: s.notificationQuery }), c.list);
router.get("/notifications/unread-count", c.unreadCount);
router.post("/notifications/read-all", c.markAllRead);
router.post("/notifications/:notificationId/read", validate({ params: s.idParam("notificationId") }), c.markRead);

module.exports = router;
