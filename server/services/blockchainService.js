const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let provider, contracts, addresses;

const initBlockchain = () => {
  try {
    provider = new ethers.JsonRpcProvider(
      process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545"
    );

    const addressFile = path.join(
      __dirname,
      "../config/contractAddresses.json"
    );

    if (!fs.existsSync(addressFile)) {
      console.warn(
        "Contract addresses not found at:",
        addressFile,
        "\nRun: npx hardhat run scripts/deploy.js --network localhost"
      );
      return;
    }

    addresses = JSON.parse(fs.readFileSync(addressFile));
    console.log("Loaded contract addresses:", addresses);

    const vulnerableABIPath = path.join(
      __dirname,
      "../config/abis/VulnerableTransfer.json"
    );
    const secureABIPath = path.join(
      __dirname,
      "../config/abis/SecureTransfer.json"
    );

    if (!fs.existsSync(vulnerableABIPath) || !fs.existsSync(secureABIPath)) {
      console.warn(
        "ABI files not found. Run deploy script again."
      );
      return;
    }

    const vulnerableABI = JSON.parse(fs.readFileSync(vulnerableABIPath));
    const secureABI = JSON.parse(fs.readFileSync(secureABIPath));

    contracts = {
      vulnerable: new ethers.Contract(
        addresses.vulnerableContract,
        vulnerableABI,
        provider
      ),
      secure: new ethers.Contract(
        addresses.secureContract,
        secureABI,
        provider
      ),
    };

    console.log("Blockchain service initialized successfully");
    console.log("  Vulnerable contract:", addresses.vulnerableContract);
    console.log("  Secure contract:", addresses.secureContract);
  } catch (err) {
    console.error("Blockchain init error:", err.message);
  }
};

const blockchainService = {
  init: initBlockchain,

  getProvider() {
    return provider;
  },

  getContracts() {
    if (!contracts) throw new Error("Blockchain not initialized. Deploy contracts first.");
    return contracts;
  },

  getAddresses() {
    if (!addresses) throw new Error("Contract addresses not loaded. Deploy contracts first.");
    return addresses;
  },

  async getBalance(contractType, address) {
    if (!contracts) {
      throw new Error(
        "Blockchain not initialized. Make sure Hardhat node is running and contracts are deployed."
      );
    }

    if (!contracts[contractType]) {
      throw new Error(
        `Unknown contract type: ${contractType}. Use 'vulnerable' or 'secure'.`
      );
    }

    if (!ethers.isAddress(address)) {
      throw new Error(`Invalid Ethereum address: ${address}`);
    }

    try {
      const balance = await contracts[contractType].getBalance(address);
      return ethers.formatEther(balance);
    } catch (err) {
      throw new Error(
        `Failed to get balance from ${contractType} contract: ${err.message}`
      );
    }
  },

  async getNonce(address) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const nonce = await contracts.secure.getNonce(address);
    return Number(nonce);
  },

  async getSignerWithPrivateKey(privateKey) {
    if (!provider) throw new Error("Provider not initialized");
    return new ethers.Wallet(privateKey, provider);
  },

  async executeVulnerableTransfer(signerPrivateKey, to, amount, signature) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const signer = await this.getSignerWithPrivateKey(signerPrivateKey);
    const contractWithSigner = contracts.vulnerable.connect(signer);
    const tx = await contractWithSigner.transfer(
      to,
      ethers.parseEther(amount),
      signature
    );
    return await tx.wait();
  },

  async executeSecureTransfer(
    signerPrivateKey,
    to,
    amount,
    nonce,
    deadline,
    signature
  ) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const signer = await this.getSignerWithPrivateKey(signerPrivateKey);
    const contractWithSigner = contracts.secure.connect(signer);
    const tx = await contractWithSigner.secureTransfer(
      to,
      ethers.parseEther(amount),
      nonce,
      deadline,
      signature
    );
    return await tx.wait();
  },

  async deposit(signerPrivateKey, contractType, amount) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const signer = await this.getSignerWithPrivateKey(signerPrivateKey);
    const contractWithSigner = contracts[contractType].connect(signer);
    const tx = await contractWithSigner.deposit({
      value: ethers.parseEther(amount),
    });
    return await tx.wait();
  },

  buildMessageHash(from, to, amount, nonce, deadline, chainId, contractAddress) {
    return ethers.solidityPackedKeccak256(
      [
        "address",
        "address",
        "uint256",
        "uint256",
        "uint256",
        "uint256",
        "address",
      ],
      [
        from,
        to,
        ethers.parseEther(amount),
        nonce,
        deadline,
        chainId,
        contractAddress,
      ]
    );
  },

  isInitialized() {
    return !!(provider && contracts && addresses);
  },
};

// Initialize on load
initBlockchain();

module.exports = blockchainService;