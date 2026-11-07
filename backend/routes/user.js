const express = require("express");
const c = require("../controller/userController");
const validate = require("../middleware/validate");
const s = require("../schemas");

const router = express.Router();
const userId = validate({ params: s.idParam("userId") });

router.get("/get-all-users", validate({ query: s.userSearch }), c.get_all_users);
router.get("/get-user-by-id/:userId", userId, c.get_user_by_id);
router.get("/get-all-my-projects-by-user-id/:userId", userId, c.get_all_my_projects_by_user_id);
router.get("/get-all-involved-projects-by-user-id/:userId", userId, c.get_all_involved_projects_by_user_id);
router.get("/get-all-tasks-by-user-id/:userId", userId, c.get_all_tasks_by_user_id);

router.post("/create-new-project-for-user-id/:userId", validate({ params: s.idParam("userId"), body: s.createProject }), c.create_new_project_for_user_id);
router.put("/update-user-profile/:userId", validate({ params: s.idParam("userId"), body: s.updateProfile }), c.update_user_profile_by_user_id);
router.delete("/delete-user/:userId", userId, c.delete_user_by_user_id);

module.exports = router;
