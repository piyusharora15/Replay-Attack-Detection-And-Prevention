// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecureTransfer
 * @dev Secure contract with multi-layer replay attack prevention:
 * 1. Nonce tracking (each transaction has a unique nonce)
 * 2. Deadline/timestamp validation (transactions expire)
 * 3. Chain ID binding (prevents cross-chain replay)
 * 4. Used signature tracking (prevents signature reuse)
 */
contract SecureTransfer {
    // State variables
    mapping(address => uint256) public balances;
    mapping(address => uint256) public nonces;         // Per-user nonce tracking
    mapping(bytes32 => bool) public usedSignatures;    // Track used signatures

    uint256 public immutable chainId;
    address public immutable contractAddress;

    // Events
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    );
    event Deposit(address indexed user, uint256 amount);
    event ReplayAttackBlocked(
        address indexed attacker,
        bytes32 signatureHash,
        string reason,
        uint256 timestamp
    );

    constructor() {
        uint256 id;
        assembly { id := chainid() }
        chainId = id;
        contractAddress = address(this);
    }

    // Deposit ETH
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev SECURE transfer with full replay protection
     * @param to Recipient address
     * @param amount Amount to transfer
     * @param nonce Unique transaction nonce (must match user's current nonce)
     * @param deadline Transaction expiry timestamp
     * @param signature Cryptographic signature
     */
    function secureTransfer(
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 deadline,
        bytes memory signature
    ) external {
        // PROTECTION 1: Deadline check — prevents old transactions from being replayed
        require(block.timestamp <= deadline, "Transaction expired");

        // PROTECTION 2: Nonce check — each user's nonce must be sequential
        require(nonce == nonces[msg.sender], "Invalid nonce: possible replay attack");

        // PROTECTION 3: Build message hash with chainId and contract address
        // This binds the signature to THIS chain and THIS contract
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                msg.sender,
                to,
                amount,
                nonce,
                deadline,
                chainId,           // Chain binding — prevents cross-chain replay
                contractAddress    // Contract binding — prevents cross-contract replay
            )
        );

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );

        // PROTECTION 4: Check if this exact signature was already used
        if (usedSignatures[ethSignedHash]) {
            emit ReplayAttackBlocked(msg.sender, ethSignedHash, "Signature already used", block.timestamp);
            revert("Replay attack detected: signature already used");
        }

        // Verify the signature
        address signer = recoverSigner(ethSignedHash, signature);
        require(signer == msg.sender, "Invalid signature");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // Mark signature as used — this is the core replay prevention
        usedSignatures[ethSignedHash] = true;

        // Increment nonce BEFORE transfer (checks-effects-interactions pattern)
        nonces[msg.sender]++;

        // Execute transfer
        balances[msg.sender] -= amount;
        balances[to] += amount;

        emit Transfer(msg.sender, to, amount, nonce, block.timestamp);
    }

    /**
     * @dev Get the current nonce for a user (frontend needs this to build transactions)
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }

    function isSignatureUsed(bytes32 sigHash) external view returns (bool) {
        return usedSignatures[sigHash];
    }

    // Signature recovery helpers
    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        (bytes32 r, bytes32 s, uint8 v) = splitSignature(sig);
        return ecrecover(hash, v, r, s);
    }

    function splitSignature(bytes memory sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
    }
}