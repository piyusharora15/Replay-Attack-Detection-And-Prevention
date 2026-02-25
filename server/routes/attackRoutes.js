const express = require("express");
const router = express.Router();
const attackController = require("../controllers/attackController");

router.get("/logs", attackController.getLogs);
router.post("/simulate", attackController.simulateReplayAttack);
router.delete("/logs", attackController.clearLogs);

module.exports = router;