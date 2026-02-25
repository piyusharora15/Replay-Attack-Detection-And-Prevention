/**
 * In-memory nonce tracker for middleware-level replay detection
 * Tracks used nonces per address per chain
 */

const usedNonces = new Map(); // key: `${chainId}-${address}`, value: Set of used nonces
const usedSignatures = new Set(); // Track used signatures at middleware level
const recentTransactions = new Map(); // Track recent txs for timing-based detection

const NONCE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const nonceService = {
  /**
   * Check if a nonce has been used for an address on a chain
   */
  isNonceUsed(chainId, address, nonce) {
    const key = `${chainId}-${address.toLowerCase()}`;
    const nonceSet = usedNonces.get(key);
    return nonceSet ? nonceSet.has(nonce) : false;
  },

  /**
   * Mark a nonce as used
   */
  markNonceUsed(chainId, address, nonce) {
    const key = `${chainId}-${address.toLowerCase()}`;
    if (!usedNonces.has(key)) {
      usedNonces.set(key, new Set());
    }
    usedNonces.get(key).add(nonce);
  },

  /**
   * Check if a signature has been used
   */
  isSignatureUsed(signature) {
    return usedSignatures.has(signature);
  },

  /**
   * Mark signature as used
   */
  markSignatureUsed(signature) {
    usedSignatures.add(signature);
  },

  /**
   * Check if a transaction is a replay based on timing (same params within short window)
   */
  isTimingReplay(from, to, amount, windowMs = 5000) {
    const key = `${from}-${to}-${amount}`;
    const lastTime = recentTransactions.get(key);
    const now = Date.now();
    if (lastTime && now - lastTime < windowMs) {
      return true;
    }
    recentTransactions.set(key, now);
    return false;
  },

  /**
   * Check deadline validity
   */
  isExpired(deadlineTimestamp) {
    return Math.floor(Date.now() / 1000) > deadlineTimestamp;
  },

  getStats() {
    return {
      trackedAddresses: usedNonces.size,
      usedSignatures: usedSignatures.size,
      recentTransactions: recentTransactions.size,
    };
  },
};

module.exports = nonceService;