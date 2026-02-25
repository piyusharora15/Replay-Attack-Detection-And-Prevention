const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { replayDetector } = require("../middleware/replayDetector");

router.get("/", transactionController.getAll);
router.post("/send", replayDetector, transactionController.sendTransaction);
router.post("/deposit", transactionController.deposit);
router.get("/balance/:contractType/:address", transactionController.getBalance);

module.exports = router;