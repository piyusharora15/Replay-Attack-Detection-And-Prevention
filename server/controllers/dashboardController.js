const Transaction = require("../models/Transaction");
const AttackLog = require("../models/AttackLog");
const nonceService = require("../services/nonceService");
const { isPreventionEnabled, setPreventionEnabled } = require("../middleware/replayDetector");
const { emitPreventionToggle } = require("../utils/socketManager");

const dashboardController = {
  // Get stats for the dashboard
  async getStats(req, res) {
    try {
      const [
        totalTransactions,
        successfulTx,
        failedTx,
        totalAttacks,
        blockedAttacks,
        successfulAttacks,
        attacksByType,
        recentAttacks,
        recentTransactions,
      ] = await Promise.all([
        Transaction.countDocuments(),
        Transaction.countDocuments({ status: "success" }),
        Transaction.countDocuments({ status: "failed" }),
        AttackLog.countDocuments(),
        AttackLog.countDocuments({ blocked: true }),
        AttackLog.countDocuments({ blocked: false }),
        AttackLog.aggregate([{ $group: { _id: "$attackType", count: { $sum: 1 } } }]),
        AttackLog.find().sort({ createdAt: -1 }).limit(5),
        Transaction.find().sort({ createdAt: -1 }).limit(5),
      ]);

      res.json({
        success: true,
        data: {
          transactions: { total: totalTransactions, successful: successfulTx, failed: failedTx },
          attacks: {
            total: totalAttacks,
            blocked: blockedAttacks,
            successful: successfulAttacks,
            blockRate: totalAttacks > 0 ? ((blockedAttacks / totalAttacks) * 100).toFixed(1) : 0,
            byType: attacksByType,
          },
          nonceService: nonceService.getStats(),
          preventionEnabled: isPreventionEnabled(),
          recentAttacks,
          recentTransactions,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Toggle prevention on/off
  async togglePrevention(req, res) {
    try {
      const { enabled } = req.body;
      setPreventionEnabled(enabled);
      emitPreventionToggle(enabled);
      res.json({
        success: true,
        preventionEnabled: enabled,
        message: `Replay attack prevention ${enabled ? "ENABLED" : "DISABLED"}`,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = dashboardController;