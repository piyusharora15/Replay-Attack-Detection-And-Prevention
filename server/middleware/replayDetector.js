const nonceService = require("../services/nonceService");
const AttackLog = require("../models/AttackLog");
const { emitAttackDetected } = require("../utils/socketManager");

// Global prevention state (can be toggled via API)
let preventionEnabled = true;

const setPreventionEnabled = (val) => { preventionEnabled = val; };
const isPreventionEnabled = () => preventionEnabled;

/**
 * Core middleware: detects and optionally blocks replay attacks
 * Runs before any transaction is processed
 */
const replayDetector = async (req, res, next) => {
  const { from, to, amount, nonce, deadline, signature, chainId } = req.body;

  const attacksDetected = [];

  // --- DETECTION 1: Signature Replay ---
  if (signature && nonceService.isSignatureUsed(signature)) {
    attacksDetected.push({
      type: "signature_replay",
      reason: "This exact signature has been used before",
      layer: "middleware",
    });
  }

  // --- DETECTION 2: Nonce Replay ---
  if (from && nonce !== undefined && chainId) {
    if (nonceService.isNonceUsed(chainId, from, nonce)) {
      attacksDetected.push({
        type: "nonce_replay",
        reason: `Nonce ${nonce} already used for address ${from} on chain ${chainId}`,
        layer: "middleware",
      });
    }
  }

  // --- DETECTION 3: Expired Transaction ---
  if (deadline && nonceService.isExpired(deadline)) {
    attacksDetected.push({
      type: "expired_tx",
      reason: `Transaction deadline ${deadline} has passed`,
      layer: "middleware",
    });
  }

  // --- DETECTION 4: Timing-Based Rapid Replay ---
  if (from && to && amount) {
    if (nonceService.isTimingReplay(from, to, amount)) {
      attacksDetected.push({
        type: "signature_replay",
        reason: "Identical transaction parameters detected within 5 second window",
        layer: "middleware",
      });
    }
  }

  // Log and emit all detected attacks
  for (const attack of attacksDetected) {
    const log = await AttackLog.create({
      attackType: attack.type,
      attackerAddress: from,
      victimAddress: from,
      replayedSignature: signature,
      detectedAt: attack.layer,
      blocked: preventionEnabled,
      reason: attack.reason,
      preventionEnabled,
    });

    emitAttackDetected({
      id: log._id,
      attackType: attack.type,
      reason: attack.reason,
      from,
      blocked: preventionEnabled,
    });
  }

  // Block if prevention is enabled and attacks detected
  if (preventionEnabled && attacksDetected.length > 0) {
    return res.status(403).json({
      success: false,
      message: "Replay attack detected and blocked",
      attacks: attacksDetected,
      preventionEnabled: true,
    });
  }

  // Mark signature and nonce as used AFTER passing (for future detection)
  req.replayAttacksDetected = attacksDetected;
  req.markTransactionUsed = () => {
    if (signature) nonceService.markSignatureUsed(signature);
    if (from && nonce !== undefined && chainId) nonceService.markNonceUsed(chainId, from, nonce);
  };

  next();
};

module.exports = { replayDetector, setPreventionEnabled, isPreventionEnabled };