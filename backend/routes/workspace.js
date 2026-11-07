const express = require("express");
const { z } = require("zod");
const c = require("../controller/workspaceController");
const validate = require("../middleware/validate");
const s = require("../schemas");

const router = express.Router();
const ws = s.idParam("workspaceId");
const wsAndUser = z.object({ ...ws.shape, ...s.idParam("userId").shape });
const wsAndInvite = z.object({ ...ws.shape, ...s.idParam("inviteId").shape });

router.get("/workspaces", c.list);
router.post("/workspaces", validate({ body: s.workspaceName }), c.create);
router.get("/workspaces/:workspaceId", validate({ params: ws }), c.get);
router.patch("/workspaces/:workspaceId", validate({ params: ws, body: s.workspaceName }), c.rename);
router.delete("/workspaces/:workspaceId", validate({ params: ws }), c.remove);

router.patch("/workspaces/:workspaceId/members/:userId", validate({ params: wsAndUser, body: s.memberRole }), c.setRole);
router.delete("/workspaces/:workspaceId/members/:userId", validate({ params: wsAndUser }), c.removeMember);
router.post("/workspaces/:workspaceId/transfer", validate({ params: ws, body: s.transferOwnership }), c.transferOwnership);

router.post("/workspaces/:workspaceId/invites", validate({ params: ws, body: s.createInvite }), c.createInvite);
router.get("/workspaces/:workspaceId/invites", validate({ params: ws }), c.listInvites);
router.post("/workspaces/:workspaceId/invites/:inviteId/regenerate", validate({ params: wsAndInvite }), c.regenerateInvite);
router.delete("/workspaces/:workspaceId/invites/:inviteId", validate({ params: wsAndInvite }), c.revokeInvite);

// the invited person's side
router.get("/invites/mine", c.mine);
router.post("/invites/accept", validate({ body: s.acceptInvite }), c.acceptByToken);
router.post("/invites/:inviteId/accept", validate({ params: s.idParam("inviteId") }), c.acceptById);
router.post("/invites/:inviteId/decline", validate({ params: s.idParam("inviteId") }), c.declineById);

module.exports = router;
