// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  AionicaPriceOracle.sol
//  Wrapper del oracle nativo WLD/USD de World Chain
//  AIONICA Security Lab — v1.0
//  Implementa IPriceOracle de MembershipInsurance_v1.sol
//  Decimales: 18 (oracle nativo World Chain)
//  Interface: Chainlink-compatible (latestRoundData)
// ============================================================

interface IChainlinkOracle {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    function decimals() external view returns (uint8);
}

contract AionicaPriceOracle {

    // Oracle nativo WLD/USD en World Chain
    address public constant WLD_ORACLE = 0x8Bb2943AB030E3eE05a58d9832525B4f60A97FA0;
    address public constant WLD        = 0x2cFc85d8E48F8EAB294be644d9E25C3030863003;

    // Staleness: precio no puede tener mas de 1 hora
    uint256 public constant MAX_STALENESS = 1 hours;

    error StalePrice();
    error InvalidPrice();
    error UnsupportedToken();

    // ── IPriceOracle interface ─────────────────────────────

    /// @notice Retorna precio del token en USD
    /// @return price    precio con 18 decimales
    /// @return decimals 18
    function getTokenPrice(address token)
        external view returns (uint256 price, uint8 decimals)
    {
        if (token != WLD) revert UnsupportedToken();

        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,
        ) = IChainlinkOracle(WLD_ORACLE).latestRoundData();

        if (answer <= 0) revert InvalidPrice();
        if (block.timestamp > updatedAt + MAX_STALENESS) revert StalePrice();

        price    = uint256(answer);
        decimals = 18;
    }

    /// @notice Ver precio actual sin staleness check (para UI)
    function getPriceUnsafe() external view returns (uint256 price, uint256 updatedAt) {
        (, int256 answer, , uint256 _updatedAt,) =
            IChainlinkOracle(WLD_ORACLE).latestRoundData();
        price     = uint256(answer);
        updatedAt = _updatedAt;
    }
}
