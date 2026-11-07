const express = require("express");
const c = require("../controller/taskController");
const validate = require("../middleware/validate");
const s = require("../schemas");

const router = express.Router();
const tid = s.idParam("taskId");

router.get("/get-task-by-id/:taskId", validate({ params: tid }), c.get_task_by_id);

router.put("/edit-task-by-id/:taskId", validate({ params: tid, body: s.editTask }), c.edit_task_by_id);
router.put("/change-task-status-by-id/:taskId", validate({ params: tid, body: s.changeStatus }), c.change_task_status_by_id);

router.post("/add-comment-to-task-by-id/:taskId", validate({ params: tid, body: s.comment }), c.add_comment_by_task_id);
router.post("/add-media-to-task/:taskId", validate({ params: tid, body: s.addMedia }), c.add_new_media_to_task);

router.delete("/remove-media-from-task/:taskId", validate({ params: tid, body: s.removeMedia }), c.remove_media_from_task);
router.delete("/delete-task-by-id/:taskId", validate({ params: tid }), c.delete_task_by_id);

module.exports = router;
