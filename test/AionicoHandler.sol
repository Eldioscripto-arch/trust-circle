// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "../src/AionicoToken_v5_1.sol";

contract AionicoHandler is Test {
    AionicoToken public token;
    address public teamWallet;
    address public trustCircle;

    constructor(AionicoToken _token, address _team, address _circle) {
        token = _token;
        teamWallet = _team;
        trustCircle = _circle;
    }

    function claimTeamVesting() public {
        // Solo intentamos si pasó el cliff para evitar reverts constantes que ensucian el test
        if (block.timestamp >= token.cliffEndsAt()) {
            vm.prank(teamWallet);
            try token.claimTeamVesting() {} catch {}
        }
    }

    function mintPaymentReward(address recipient) public {
        if (recipient == address(0) || recipient == address(token)) return;
        vm.prank(trustCircle);
        try token.mintPaymentReward(recipient) {} catch {}
    }

    function togglePause(bool pause) public {
        vm.prank(token.owner());
        if (pause) {
            token.pauseRewards();
        } else {
            token.unpauseRewards();
        }
    }

    // Foundry usará esto para saltar en el tiempo de forma aleatoria entre llamadas
    function warpTime(uint256 amount) public {
        uint256 jump = bound(amount, 0, 365 days);
        vm.warp(block.timestamp + jump);
    }
}
