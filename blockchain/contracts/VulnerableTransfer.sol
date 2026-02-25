// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title VulnerableTransfer
 * @dev A deliberately vulnerable contract that does NOT protect against replay attacks
 * Used to demonstrate how replay attacks succeed without protection
 */
contract VulnerableTransfer {
    mapping(address => uint256) public balances;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Deposit(address indexed user, uint256 amount);

    // Deposit ETH into the contract
    function deposit() external payable {
        balances[msg.sender] += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    /**
     * @dev VULNERABLE: This function uses a signature but does NOT track used signatures
     * An attacker can replay the same signed transaction multiple times!
     */
    function transfer(
        address to,
        uint256 amount,
        bytes memory signature
    ) external {
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, to, amount));
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address signer = recoverSigner(ethSignedHash, signature);
        require(signer == msg.sender, "Invalid signature");
        require(balances[msg.sender] >= amount, "Insufficient balance");

        // VULNERABILITY: No replay protection! Same signature can be used again and again
        balances[msg.sender] -= amount;
        balances[to] += amount;

        emit Transfer(msg.sender, to, amount);
    }

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

    function getBalance(address user) external view returns (uint256) {
        return balances[user];
    }
}