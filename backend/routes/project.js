const express = require("express");
const c = require("../controller/projectController");
const validate = require("../middleware/validate");
const s = require("../schemas");

const router = express.Router();
const pid = s.idParam("projectId");

router.get("/get-all-projects", c.get_all_projects);
router.get("/get-project-by-id/:projectId", validate({ params: pid }), c.get_project_by_id);
router.get("/get-project-members-by-id/:projectId", validate({ params: pid }), c.get_project_members_by_id);
router.get("/get-all-tasks-by-project-id/:projectId", validate({ params: pid }), c.get_all_tasks_by_project_id);
router.get("/get-project-overall-performance-by-id/:projectId", validate({ params: pid }), c.get_project_overall_performance_by_id);

router.post("/add-new-member-by-project-id/:projectId", validate({ params: pid, body: s.memberBody }), c.add_member_to_project_by_id);
router.post("/add-new-task-by-project-id/:projectId", validate({ params: pid, body: s.addTask }), c.add_new_task_to_project_by_id);
router.post("/add-media-to-project/:projectId", validate({ params: pid, body: s.addMedia }), c.add_new_media_to_project);
router.post("/add-comment-to-project-by-id/:projectId", validate({ params: pid, body: s.comment }), c.add_comment_by_project_id);

router.put("/edit-project-by-id/:projectId", validate({ params: pid, body: s.editProject }), c.edit_project_by_id);

router.delete("/remove-member-from-project-by-id/:projectId", validate({ params: pid, body: s.memberBody }), c.remove_member_from_project_by_id);
router.delete("/delete-project-by-id/:projectId", validate({ params: pid }), c.delete_project_by_id);
router.delete("/remove-media-from-project/:projectId", validate({ params: pid, body: s.removeMedia }), c.remove_media_from_project);

module.exports = router;
