// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import "../src/AionicoToken_v5_1.sol"; // Asegúrate de que la ruta coincida con tu src

contract AionicoVestingTest is Test {
    AionicoToken public token;

    address trustCircle = address(0x10);
    address teamWallet = address(0x20);
    address insuranceFund = address(0x30);
    address ecosystemFund = address(0x40);
    address liquidityWallet = address(0x50);

    function setUp() public {
        token = new AionicoToken(
            trustCircle,
            teamWallet,
            insuranceFund,
            ecosystemFund,
            liquidityWallet
        );
    }

    // ── PRUEBA 1: Fuzzing de Precisión Temporal ──
    // Inyecta valores aleatorios de tiempo (timeJump) entre 1 segundo y 730 días
    function testFuzz_VestingPrecision(uint256 timeJump) public {
        vm.assume(timeJump > 0 && timeJump <= 730 days);

        uint256 cliffEnd = token.cliffEndsAt();
        
        // Saltamos al final del cliff
        vm.warp(cliffEnd);
        assertEq(token.vestingClaimable(), 0, "Vested at cliff end should be exactly 0");

        // Saltamos hacia el futuro un tiempo aleatorio
        vm.warp(cliffEnd + timeJump);
        uint256 claimable = token.vestingClaimable();

        if (timeJump == 730 days) {
            assertEq(claimable, token.TEAM_ALLOCATION(), "At exact end, claimable must match total allocation");
        } else {
            assertLt(claimable, token.TEAM_ALLOCATION(), "Before end, claimable must be less than total");
            assertGt(claimable, 0, "After cliff, claimable must be greater than 0");
        }
    }

    // ── PRUEBA 2: Estrés de Micro-Reclamos (Dust Test) ──
    // Simula al equipo reclamando tokens TODOS LOS DÍAS durante 2 años
    // para asegurar que las divisiones sucesivas no pierden ni 1 wei.
    function test_VestingNoDustOnDailyClaims() public {
        uint256 cliffEnd = token.cliffEndsAt();
        uint256 step = 1 days;
        uint256 totalClaimed = 0;

        vm.startPrank(teamWallet);
        
        for(uint256 i = 1; i <= 730; i++) {
            vm.warp(cliffEnd + (i * step));
            
            uint256 balBefore = token.balanceOf(teamWallet);
            token.claimTeamVesting();
            uint256 balAfter = token.balanceOf(teamWallet);
            
            totalClaimed += (balAfter - balBefore);
        }
        
        vm.stopPrank();

        // Verificación crítica: La suma de 730 reclamos fraccionados debe ser EXACTAMENTE 20 Millones.
        assertEq(totalClaimed, token.TEAM_ALLOCATION(), "CRITICAL FAILURE: Precision dust lost during multiple claims");
    }
}
