const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Deploying contracts...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log(
    "Account balance:",
    (await hre.ethers.provider.getBalance(deployer.address)).toString()
  );

  // Deploy Vulnerable Contract
  const VulnerableTransfer = await hre.ethers.getContractFactory(
    "VulnerableTransfer"
  );
  const vulnerable = await VulnerableTransfer.deploy();
  await vulnerable.waitForDeployment();
  console.log(
    "VulnerableTransfer deployed to:",
    await vulnerable.getAddress()
  );

  // Deploy Secure Contract
  const SecureTransfer = await hre.ethers.getContractFactory("SecureTransfer");
  const secure = await SecureTransfer.deploy();
  await secure.waitForDeployment();
  console.log("SecureTransfer deployed to:", await secure.getAddress());

  // Save addresses to your 'server' folder
  const addresses = {
    vulnerableContract: await vulnerable.getAddress(),
    secureContract: await secure.getAddress(),
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployedAt: new Date().toISOString(),
  };

  // ✅ Fixed path — points to 'server' instead of 'backend'
  const outputPath = path.join(
    __dirname,
    "../../server/config/contractAddresses.json"
  );

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log(
    "Contract addresses saved to server/config/contractAddresses.json"
  );

  // Copy ABIs to your 'server' folder
  const artifactsPath = path.join(__dirname, "../artifacts/contracts");

  // ✅ Fixed path — points to 'server' instead of 'backend'
  const abiOutputPath = path.join(__dirname, "../../server/config/abis");
  fs.mkdirSync(abiOutputPath, { recursive: true });

  const vulnerableABI = JSON.parse(
    fs.readFileSync(
      path.join(
        artifactsPath,
        "VulnerableTransfer.sol/VulnerableTransfer.json"
      )
    )
  ).abi;

  const secureABI = JSON.parse(
    fs.readFileSync(
      path.join(artifactsPath, "SecureTransfer.sol/SecureTransfer.json")
    )
  ).abi;

  fs.writeFileSync(
    path.join(abiOutputPath, "VulnerableTransfer.json"),
    JSON.stringify(vulnerableABI, null, 2)
  );

  fs.writeFileSync(
    path.join(abiOutputPath, "SecureTransfer.json"),
    JSON.stringify(secureABI, null, 2)
  );

  console.log("ABIs copied to server/config/abis/");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});