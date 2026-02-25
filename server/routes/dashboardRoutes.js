const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");

router.get("/stats", dashboardController.getStats);
router.post("/toggle-prevention", dashboardController.togglePrevention);

module.exports = router;