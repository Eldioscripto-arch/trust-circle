// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;
import {Script} from "forge-std/Script.sol";
import {AionicoToken} from "../src/AionicoToken_v5_1.sol";

contract Deploy is Script {
    function run() public {
        vm.startBroadcast();
        new AionicoToken(
            0xc32Bdc20014B8aE63FCA57597b29DAC856BCE2Cf,
            0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137,
            0xB953016dF10c80496E86E8779697972cC9780094,
            0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137,
            0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137
        );
        vm.stopBroadcast();
    }
}
