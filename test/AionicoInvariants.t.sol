// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "./AionicoHandler.sol";
import "../src/AionicoToken_v5_1.sol";

contract AionicoInvariants is Test {
    AionicoToken public token;
    AionicoHandler public handler;

    address admin = address(0xAD);
    address team = address(0x20);
    address circle = address(0x10);

    function setUp() public {
        vm.prank(admin);
        token = new AionicoToken(circle, team, address(0x3), address(0x4), address(0x5));
        handler = new AionicoHandler(token, team, circle);

        // Indicamos a Foundry que use el Handler para las pruebas
        targetContract(address(handler));
    }

    /// @dev INVARIANTE: El balance del contrato debe ser exactamente igual a
    /// lo que queda por distribuir de Rewards + lo que queda por reclamar de Vesting.
    function invariant_ContractBalanceSolvency() public view {
        uint256 totalInContract = token.balanceOf(address(token));
        
        uint256 remainingRewards = token.REWARDS_POOL() - token.rewardsDistributed();
        uint256 remainingTeam = token.TEAM_ALLOCATION() - token.teamVestingClaimed();

        assertEq(totalInContract, remainingRewards + remainingTeam, "Solvency Equation Broken");
    }
}
