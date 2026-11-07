const express = require("express");
const c = require("../controller/uploadController");

const router = express.Router();
router.post("/uploads/sign", c.sign);

module.exports = router;
