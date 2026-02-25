const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

let provider, contracts, addresses;

const initBlockchain = () => {
  try {
    provider = new ethers.JsonRpcProvider(process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545");

    const addressFile = path.join(__dirname, "../config/contractAddresses.json");
    if (!fs.existsSync(addressFile)) {
      console.warn("Contract addresses not found. Run 'npx hardhat run scripts/deploy.js' first.");
      return;
    }

    addresses = JSON.parse(fs.readFileSync(addressFile));

    const vulnerableABI = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../config/abis/VulnerableTransfer.json"))
    );
    const secureABI = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../config/abis/SecureTransfer.json"))
    );

    contracts = {
      vulnerable: new ethers.Contract(addresses.vulnerableContract, vulnerableABI, provider),
      secure: new ethers.Contract(addresses.secureContract, secureABI, provider),
    };

    console.log("Blockchain service initialized");
    console.log("  Vulnerable contract:", addresses.vulnerableContract);
    console.log("  Secure contract:", addresses.secureContract);
  } catch (err) {
    console.error("Blockchain init error:", err.message);
  }
};

const blockchainService = {
  init: initBlockchain,

  getProvider() { return provider; },
  getContracts() { return contracts; },
  getAddresses() { return addresses; },

  async getBalance(contractType, address) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const contract = contracts[contractType];
    const balance = await contract.getBalance(address);
    return ethers.formatEther(balance);
  },

  async getNonce(address) {
    if (!contracts) throw new Error("Blockchain not initialized");
    const nonce = await contracts.secure.getNonce(address);
    return Number(nonce);
  },

  async getSignerWithPrivateKey(privateKey) {
    return new ethers.Wallet(privateKey, provider);
  },

  async executeVulnerableTransfer(signerPrivateKey, to, amount, signature) {
    const signer = await this.getSignerWithPrivateKey(signerPrivateKey);
    const contractWithSigner = contracts.vulnerable.connect(signer);
    const tx = await contractWithSigner.transfer(to, ethers.parseEther(amount), signature);
    return await tx.wait();
  },

  async executeSecureTransfer(signerPrivateKey, to, amount, nonce, deadline, signature) {
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
    const signer = await this.getSignerWithPrivateKey(signerPrivateKey);
    const contractWithSigner = contracts[contractType].connect(signer);
    const tx = await contractWithSigner.deposit({ value: ethers.parseEther(amount) });
    return await tx.wait();
  },

  buildMessageHash(from, to, amount, nonce, deadline, chainId, contractAddress) {
    return ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "uint256", "uint256", "address"],
      [from, to, ethers.parseEther(amount), nonce, deadline, chainId, contractAddress]
    );
  },
};

module.exports = blockchainService;