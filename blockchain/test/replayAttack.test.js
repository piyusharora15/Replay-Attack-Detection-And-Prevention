const { expect } = require("chai");
const hre = require("hardhat");

describe("Replay Attack Tests", function () {
  let vulnerable, secure;
  let owner, user1, user2, attacker;

  beforeEach(async () => {
    [owner, user1, user2, attacker] = await hre.ethers.getSigners();

    const Vulnerable = await hre.ethers.getContractFactory("VulnerableTransfer");
    vulnerable = await Vulnerable.deploy();

    const Secure = await hre.ethers.getContractFactory("SecureTransfer");
    secure = await Secure.deploy();
  });

  describe("VulnerableTransfer — Replay Attack Succeeds", () => {
    it("Should allow replay attack on vulnerable contract", async () => {
      // Deposit
      await vulnerable.connect(user1).deposit({ value: hre.ethers.parseEther("1.0") });

      const amount = hre.ethers.parseEther("0.1");
      const messageHash = hre.ethers.solidityPackedKeccak256(
        ["address", "address", "uint256"],
        [user1.address, user2.address, amount]
      );
      const signature = await user1.signMessage(hre.ethers.getBytes(messageHash));

      // First (legitimate) transaction
      await vulnerable.connect(user1).transfer(user2.address, amount, signature);
      expect(await vulnerable.getBalance(user1.address)).to.equal(hre.ethers.parseEther("0.9"));

      // REPLAY — same signature, should succeed on vulnerable contract
      await vulnerable.connect(user1).transfer(user2.address, amount, signature);
      expect(await vulnerable.getBalance(user1.address)).to.equal(hre.ethers.parseEther("0.8"));
      console.log("  ❌ Replay attack succeeded on vulnerable contract (as expected)");
    });
  });

  describe("SecureTransfer — Replay Attack Blocked", () => {
    it("Should block replay attack via nonce", async () => {
      await secure.connect(user1).deposit({ value: hre.ethers.parseEther("1.0") });

      const amount = hre.ethers.parseEther("0.1");
      const nonce = await secure.getNonce(user1.address);
      const deadline = Math.floor(Date.now() / 1000) + 3600;
      const chainId = (await hre.ethers.provider.getNetwork()).chainId;

      const messageHash = hre.ethers.solidityPackedKeccak256(
        ["address", "address", "uint256", "uint256", "uint256", "uint256", "address"],
        [user1.address, user2.address, amount, nonce, deadline, chainId, await secure.getAddress()]
      );
      const signature = await user1.signMessage(hre.ethers.getBytes(messageHash));

      // Legitimate transaction
      await secure.connect(user1).secureTransfer(user2.address, amount, nonce, deadline, signature);

      // REPLAY — should be blocked
      await expect(
        secure.connect(user1).secureTransfer(user2.address, amount, nonce, deadline, signature)
      ).to.be.revertedWith("Invalid nonce: possible replay attack");
      console.log("  ✅ Replay attack blocked on secure contract");
    });

    it("Should block expired transactions", async () => {
      await secure.connect(user1).deposit({ value: hre.ethers.parseEther("1.0") });

      const amount = hre.ethers.parseEther("0.1");
      const nonce = await secure.getNonce(user1.address);
      const expiredDeadline = Math.floor(Date.now() / 1000) - 3600; // 1 hour in the past
      const chainId = (await hre.ethers.provider.getNetwork()).chainId;

      const messageHash = hre.ethers.solidityPackedKeccak256(
        ["address", "address", "uint256", "uint256", "uint256", "uint256", "address"],
        [user1.address, user2.address, amount, nonce, expiredDeadline, chainId, await secure.getAddress()]
      );
      const signature = await user1.signMessage(hre.ethers.getBytes(messageHash));

      await expect(
        secure.connect(user1).secureTransfer(user2.address, amount, nonce, expiredDeadline, signature)
      ).to.be.revertedWith("Transaction expired");
      console.log("  ✅ Expired transaction blocked");
    });
  });
});