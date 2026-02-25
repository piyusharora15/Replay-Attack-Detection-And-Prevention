const AttackLog = require("../models/AttackLog");
const Transaction = require("../models/Transaction");
const blockchainService = require("../services/blockchainService");
const nonceService = require("../services/nonceService");
const { emitAttackDetected } = require("../utils/socketManager");
const { isPreventionEnabled } = require("../middleware/replayDetector");

const attackController = {
  // Get all attack logs
  async getLogs(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const logs = await AttackLog.find()
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      const total = await AttackLog.countDocuments();
      res.json({ success: true, data: logs, total });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  /**
   * Simulate a replay attack
   * Takes a previous transaction and tries to replay it
   */
  async simulateReplayAttack(req, res) {
    const { originalTxId, attackType } = req.body;

    try {
      // Get the original transaction
      const originalTx = await Transaction.findById(originalTxId);
      if (!originalTx) {
        return res.status(404).json({ success: false, message: "Original transaction not found" });
      }

      const preventionOn = isPreventionEnabled();
      let attackResult = {
        attackType: attackType || "signature_replay",
        originalTx: originalTxId,
        preventionEnabled: preventionOn,
        blocked: false,
        reason: null,
      };

      if (originalTx.contractType === "vulnerable") {
        // Try to replay on vulnerable contract — may succeed if prevention is off
        try {
          const receipt = await blockchainService.executeVulnerableTransfer(
            // Use a different test account as the "attacker"
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
            originalTx.to,
            originalTx.amount,
            originalTx.signature
          );

          attackResult.blocked = false;
          attackResult.reason = "ATTACK SUCCEEDED — Vulnerable contract has no replay protection";
          attackResult.txHash = receipt.hash;

          await Transaction.create({
            txHash: receipt.hash,
            from: originalTx.from,
            to: originalTx.to,
            amount: originalTx.amount,
            signature: originalTx.signature,
            contractType: "vulnerable",
            status: "success",
            isReplay: true,
          });
        } catch (e) {
          attackResult.blocked = true;
          attackResult.reason = e.message;
        }
      } else {
        // Try to replay on secure contract — should always fail
        try {
          await blockchainService.executeSecureTransfer(
            "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
            originalTx.to,
            originalTx.amount,
            originalTx.nonce,
            originalTx.deadline,
            originalTx.signature
          );
          attackResult.blocked = false;
          attackResult.reason = "Unexpected: attack succeeded despite secure contract";
        } catch (e) {
          attackResult.blocked = true;
          attackResult.reason = "Secure contract blocked: " + e.message;
        }
      }

      // Log the attack
      const log = await AttackLog.create({
        attackType: attackResult.attackType,
        attackerAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        victimAddress: originalTx.from,
        replayedSignature: originalTx.signature,
        originalTxHash: originalTx.txHash,
        detectedAt: attackResult.blocked ? "smart_contract" : "none",
        blocked: attackResult.blocked,
        reason: attackResult.reason,
        contractType: originalTx.contractType,
        preventionEnabled: preventionOn,
      });

      emitAttackDetected({
        id: log._id,
        attackType: attackResult.attackType,
        blocked: attackResult.blocked,
        reason: attackResult.reason,
        contractType: originalTx.contractType,
      });

      res.json({ success: true, data: attackResult, log });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Clear all attack logs
  async clearLogs(req, res) {
    try {
      await AttackLog.deleteMany({});
      res.json({ success: true, message: "Attack logs cleared" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = attackController;