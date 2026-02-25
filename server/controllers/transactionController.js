const Transaction = require("../models/Transaction");
const blockchainService = require("../services/blockchainService");
const { emitTransactionUpdate } = require("../utils/socketManager");

// Hardhat test accounts (for demo — in production these would come from user's wallet)
const TEST_ACCOUNTS = {
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC": "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
};

const transactionController = {
  // Get all transactions
  async getAll(req, res) {
    try {
      const { page = 1, limit = 20, contractType, status } = req.query;
      const filter = {};
      if (contractType) filter.contractType = contractType;
      if (status) filter.status = status;

      const transactions = await Transaction.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Transaction.countDocuments(filter);

      res.json({ success: true, data: transactions, total, page, pages: Math.ceil(total / limit) });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Send a transaction (legitimate)
  async sendTransaction(req, res) {
    const { from, to, amount, contractType, privateKey } = req.body;

    try {
      let receipt, txRecord;

      if (contractType === "vulnerable") {
        // Vulnerable: sign without nonce/deadline/chainId
        const { ethers } = require("ethers");
        const addresses = blockchainService.getAddresses();
        const amountWei = ethers.parseEther(amount);
        const messageHash = ethers.solidityPackedKeccak256(
          ["address", "address", "uint256"],
          [from, to, amountWei]
        );

        const wallet = new ethers.Wallet(privateKey || TEST_ACCOUNTS[from]);
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        receipt = await blockchainService.executeVulnerableTransfer(
          privateKey || TEST_ACCOUNTS[from], to, amount, signature
        );

        txRecord = await Transaction.create({
          txHash: receipt.hash,
          from, to, amount, signature,
          contractType: "vulnerable",
          status: "success",
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        // Mark as used for detection
        if (req.markTransactionUsed) req.markTransactionUsed();

      } else {
        // Secure: include nonce, deadline, chainId
        const { ethers } = require("ethers");
        const addresses = blockchainService.getAddresses();
        const chainId = parseInt(process.env.CHAIN_ID || "31337");
        const nonce = await blockchainService.getNonce(from);
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

        const messageHash = blockchainService.buildMessageHash(
          from, to, amount, nonce, deadline, chainId, addresses.secureContract
        );

        const wallet = new ethers.Wallet(privateKey || TEST_ACCOUNTS[from]);
        const signature = await wallet.signMessage(ethers.getBytes(messageHash));

        receipt = await blockchainService.executeSecureTransfer(
          privateKey || TEST_ACCOUNTS[from], to, amount, nonce, deadline, signature
        );

        txRecord = await Transaction.create({
          txHash: receipt.hash,
          from, to, amount, nonce, deadline, signature, chainId,
          contractType: "secure",
          status: "success",
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        if (req.markTransactionUsed) req.markTransactionUsed();
      }

      emitTransactionUpdate({ type: "new_transaction", transaction: txRecord });

      res.json({ success: true, data: txRecord });
    } catch (err) {
      const txRecord = await Transaction.create({
        from, to, amount,
        contractType: contractType || "secure",
        status: "failed",
      });
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Get blockchain balance
  async getBalance(req, res) {
    const { address, contractType } = req.params;
    try {
      const balance = await blockchainService.getBalance(contractType, address);
      res.json({ success: true, balance, address, contractType });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // Deposit funds
  async deposit(req, res) {
    const { address, amount, contractType, privateKey } = req.body;
    const TEST_ACCOUNTS_MAP = {
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
      "0x70997970C51812dc3A010C7d01b50e0d17dc79C8": "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    };
    try {
      const pk = privateKey || TEST_ACCOUNTS_MAP[address];
      const receipt = await blockchainService.deposit(pk, contractType, amount);
      res.json({ success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
};

module.exports = transactionController;