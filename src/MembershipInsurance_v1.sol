// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  MembershipInsurance.sol — Contrato 2
//  AIONICA Security Lab — v1.0
//  World Chain (EVM compatible)
// ============================================================
//
//  NIVELES DE MEMBRESÍA (prima anual en USDC, 6 decimales):
//  L1: $5  → cobertura 20%, tope $200/año
//  L2: $10 → cobertura 30%, tope $300/año
//  L3: $15 → cobertura 40%, tope $400/año
//  L4: $20 → cobertura 60%, tope $600/año
//  L5: $40 → cobertura 75%, tope $750/año
//
//  DISTRIBUCIÓN DE CADA PRIMA:
//  → 20% fijo al equipo de desarrollo (inmediato)
//  → 80% al fondo de seguro
//
//  EXCEDENTE AL FIN DE CICLO ANUAL:
//  → 20% reserva acumulativa (próximo año)
//  → 20% equipo de desarrollo + próximos proyectos
//  → 20% reducción de primas siguiente año
//  → 60% sorteo anual entre miembros activos sin deuda
//
//  SORTEO ESCALATIVO DESCENDENTE (60% del excedente):
//  → 1er premio: 40% del fondo → 2 ganadores
//  → 2do premio: 40% del restante → 2 ganadores
//  → 3er premio: 40% del restante → 2 ganadores
//  → 4to premio: restante → 2 ganadores
//  Ganadores seleccionados por score (sin deuda obligatorio)
// ============================================================

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IMembershipContract {
    function isEligible(address member) external view returns (bool);
    function getScore(address member) external view returns (uint256);
}

/// @dev [NV-03 FIX] Interface minima para oracle de precio — compatible con API3 y Pyth adapters
///      Deploy dia 1: oracle = address(0) → sin cobertura para WLD/AIONICO (seguro)
///      Activar cuando oracle este auditado: owner.setPriceOracle(token, adapterAddr)
interface IPriceOracle {
    /// @return price     precio del token en USD
    /// @return decimals  decimales del precio (18 para API3, 8 para Pyth)
    function getTokenPrice(address token)
        external view returns (uint256 price, uint8 decimals);
}

contract MembershipInsurance {

    // ── Constantes ────────────────────────────────────────────

    uint256 public constant USDC_DECIMALS = 1e6; // 6 decimales

    /// @dev USDC en World Chain
    address public constant USDC = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;
    address public constant WLD = 0x2cFc85d8E48F8EAB294be644d9E25C3030863003;

    /// @dev Wallet del equipo de desarrollo
    address public constant DEV_WALLET = 0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137;

    /// @dev Fee al equipo por cada prima: 20%
    uint256 public constant DEV_FEE_BPS    = 2000;
    uint256 public constant BPS_DENOMINATOR = 10_000;

    /// @dev Duración del ciclo anual
    uint256 public constant ANNUAL_CYCLE = 365 days;

    // ── Niveles de membresía ─────────────────────────────────

    struct Level {
        uint256 premiumUSDC;    // prima anual en USDC (6 dec)
        uint256 coverageBps;    // cobertura en bps (ej: 2000 = 20%)
        uint256 annualCapUSDC;  // tope máximo de cobertura anual (6 dec)
    }

    Level[6] private _levels; // índice 1–5 (0 sin usar)

    // ── Membresías activas ───────────────────────────────────

    struct Membership {
        uint8   level;
        uint256 expiresAt;           // timestamp de vencimiento
        uint256 claimedThisYear;     // USDC cubiertos en el año activo
        uint256 yearStart;           // inicio del año de cobertura
    }

    mapping(address => Membership) public memberships;

    /// @dev Lista de todos los miembros activos (para el sorteo)
    address[] public allMembers;
    mapping(address => bool) public isMember;
    mapping(address => uint256) private _memberIndex; // index + 1 en allMembers

    // ── Fondo de seguro ──────────────────────────────────────

    /// @dev [MC-07] Fondo separado por token
    mapping(address => uint256) public insuranceFundByToken;

    // ── Oracle de precio para cobertura multi-token ──────────
    /// @dev [NV-03 FIX] token => direccion del oracle adapter
    ///      address(0) = oracle no disponible = cobertura 0 para ese token
    ///      USDC no necesita oracle. WLD y AIONICO inician sin oracle (seguros desde dia 1)
    mapping(address => address) public priceOracles;

    /// @dev Reserva acumulativa del año anterior (no distribuible hasta cierre)
    uint256 public reserveBalance;

    /// @dev Total de cobertura pagada en el ciclo actual
    uint256 public totalClaimsThisCycle;

    /// @dev Primas recibidas en el ciclo actual
    uint256 public totalPremiumsThisCycle;

    // ── Descuento de prima por excedente ────────────────────

    /// @dev Descuento acumulado de primas para el próximo año (en USDC)
    uint256 public premiumDiscountPool;

    // ── Ciclo anual ──────────────────────────────────────────

    uint256 public cycleStart;
    uint256 public cycleNumber;

    // ── Roles ────────────────────────────────────────────────

    address public immutable owner;
    address public trustCircle; // único que puede llamar coverDeficit
    address public membershipContract;

    // ── Sorteo ───────────────────────────────────────────────

    struct DrawResult {
        uint256 cycleNumber;
        uint256 totalPot;
        address[8] winners;     // 4 premios × 2 ganadores = 8
        uint256[8] amounts;
        uint256 timestamp;
    }

    DrawResult[] public drawHistory;

    // ── Eventos ──────────────────────────────────────────────

    event MembershipPurchased(
        address indexed member,
        uint8   level,
        uint256 premiumPaid,
        uint256 devFee,
        uint256 addedToFund,
        uint256 expiresAt
    );
    event DeficitCovered(
        address indexed victim,
        address indexed defaulter,
        uint256 requested,
        uint256 covered,
        uint256 circleId,
        uint8   cycle
    );
    event AnnualCycleSettled(
        uint256 indexed cycleNumber,
        uint256 surplus,
        uint256 toReserve,
        uint256 toDev,
        uint256 toDiscount,
        uint256 toRaffle
    );
    event RaffleExecuted(
        uint256 indexed cycleNumber,
        address[8] winners,
        uint256[8] amounts
    );
    event TrustCircleSet(address indexed tc);
    event MembershipContractSet(address indexed mc);
    event PriceOracleSet(address indexed token, address indexed oracle); // [NV-03 FIX]

    // ── Errores ──────────────────────────────────────────────

    error NotOwner();
    error NotTrustCircle();
    error AlreadySet();
    error ZeroAddress();
    error InvalidLevel();
    error CycleNotEnded();
    error InsufficientFund();
    error TransferFailed();
    error NoEligibleMembers();

    // ── Modificadores ────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrustCircle() {
        if (msg.sender != trustCircle) revert NotTrustCircle();
        _;
    }

    // ── Constructor ──────────────────────────────────────────

    constructor() {
        owner      = msg.sender;
        cycleStart = block.timestamp;
        cycleNumber = 1;

        // L1: $5  → 20%, tope $200
        _levels[1] = Level({ premiumUSDC: 5 * USDC_DECIMALS,   coverageBps: 2000, annualCapUSDC: 200 * USDC_DECIMALS });
        // L2: $10 → 30%, tope $300
        _levels[2] = Level({ premiumUSDC: 10 * USDC_DECIMALS,  coverageBps: 3000, annualCapUSDC: 300 * USDC_DECIMALS });
        // L3: $15 → 40%, tope $400
        _levels[3] = Level({ premiumUSDC: 15 * USDC_DECIMALS,  coverageBps: 4000, annualCapUSDC: 400 * USDC_DECIMALS });
        // L4: $20 → 60%, tope $600
        _levels[4] = Level({ premiumUSDC: 20 * USDC_DECIMALS,  coverageBps: 6000, annualCapUSDC: 600 * USDC_DECIMALS });
        // L5: $40 → 75%, tope $750
        _levels[5] = Level({ premiumUSDC: 40 * USDC_DECIMALS,  coverageBps: 7500, annualCapUSDC: 750 * USDC_DECIMALS });
    }

    // ── Admin ─────────────────────────────────────────────────

    function setTrustCircle(address _tc) external onlyOwner {
        if (trustCircle != address(0)) revert AlreadySet();
        if (_tc == address(0)) revert ZeroAddress();
        trustCircle = _tc;
        emit TrustCircleSet(_tc);
    }

    function setMembershipContract(address _mc) external onlyOwner {
        if (_mc == address(0)) revert ZeroAddress();
        membershipContract = _mc;
        emit MembershipContractSet(_mc);
    }

    /// @notice [NV-03 FIX] Conectar oracle de precio para un token no-USDC
    /// @dev Deploy dia 1: oracle = address(0) → cobertura 0 para ese token (seguro)
    ///      Llamar cuando el oracle este disponible y auditado en World Chain
    ///      Pasar oracle = address(0) para desconectar
    function setPriceOracle(address token, address oracle) external onlyOwner {
        require(token != USDC, "MembershipInsurance: USDC does not need oracle");
        priceOracles[token] = oracle;
        emit PriceOracleSet(token, oracle);
    }

    // ── Vista de niveles ─────────────────────────────────────

    function getLevel(uint8 level) external view returns (Level memory) {
        if (level < 1 || level > 5) revert InvalidLevel();
        return _levels[level];
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 1 — subscribe (comprar membresía)
    // ══════════════════════════════════════════════════════

    /// @notice Comprar o renovar membresía anual
    /// @param level Nivel de membresía (1–5)
    function subscribe(uint8 level, address token) external {
        if (level < 1 || level > 5) revert InvalidLevel();
        require(token == USDC, "MembershipInsurance: premiums in USDC only");

        Level memory lv = _levels[level];
        uint256 premium = lv.premiumUSDC;

        // Aplicar descuento del pool si hay disponible
        uint256 discount = 0;
        if (premiumDiscountPool >= premium) {
            discount = premium;
            premiumDiscountPool -= premium;
            premium = 0;
        } else if (premiumDiscountPool > 0) {
            discount = premiumDiscountPool;
            premium -= discount;
            premiumDiscountPool = 0;
        }

        uint256 devFee   = 0;
        uint256 toFund   = 0;

        if (premium > 0) {
            // 20% al equipo de desarrollo — transferencia inmediata
            devFee = (premium * DEV_FEE_BPS) / BPS_DENOMINATOR;
            toFund = premium - devFee;

        // Cobrar prima al usuario
            bool ok = IERC20(token).transferFrom(msg.sender, address(this), premium);
            if (!ok) revert TransferFailed();

            // Enviar fee al equipo
            if (devFee > 0) {
                bool feeOk = IERC20(token).transfer(DEV_WALLET, devFee);
                if (!feeOk) revert TransferFailed();
            }

            insuranceFundByToken[token] += toFund; // [MC-07]
            totalPremiumsThisCycle += premium;
        }

        // Registrar membresía
        uint256 expiry;
        Membership storage m = memberships[msg.sender];

        if (m.expiresAt > block.timestamp) {
            // Renovación — extiende desde la expiración actual
            expiry = m.expiresAt + ANNUAL_CYCLE;
        } else {
            // Nueva membresía
            expiry = block.timestamp + ANNUAL_CYCLE;
            // Resetear claims anuales
            m.claimedThisYear = 0;
            m.yearStart = block.timestamp;
        }

        m.level     = level;
        m.expiresAt = expiry;

        // Agregar a la lista de miembros si es nuevo
        if (!isMember[msg.sender]) {
            isMember[msg.sender] = true;
            _memberIndex[msg.sender] = allMembers.length + 1;
            allMembers.push(msg.sender);
        }

        emit MembershipPurchased(msg.sender, level, premium + discount, devFee, toFund, expiry);
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 2 — coverDeficit (llamado por TrustCircle)
    // ══════════════════════════════════════════════════════

    /// @notice Cubrir el déficit de una víctima con membresía activa
    /// @param victim     quien recibe el pago del ciclo (afectado por el default)
    /// @param defaulter  quien no pagó (para referencia, deuda ya registrada en Contrato 3)
    /// @param amount     monto del slot faltante (contributionAmount del círculo)
    /// @param circleId   id del círculo
    /// @param cycle      ciclo donde ocurrió el incumplimiento
    /// @param token      token del círculo (USDC path directo, WLD/AIONICO requieren oracle)
    /// @return covered   cantidad en tokens realmente cubierta y transferida al TrustCircle
    /// [NV-03 FIX] Cap siempre en USD — sin oracle WLD/AIONICO retorna 0 (seguro desde dia 1)
    function coverDeficit(
        address victim,
        address defaulter,
        uint256 amount,
        uint256 circleId,
        uint8   cycle,
        address token
    ) external onlyTrustCircle returns (uint256 covered) {

        // ── Verificar membresía activa ──
        Membership storage m = memberships[victim];
        if (m.expiresAt <= block.timestamp) return 0;
        if (amount == 0) return 0;

        Level memory lv = _levels[m.level];

        // ── Resetear año si corresponde ──
        if (block.timestamp >= m.yearStart + ANNUAL_CYCLE) {
            m.claimedThisYear = 0;
            m.yearStart = block.timestamp;
        }
        if (m.claimedThisYear >= lv.annualCapUSDC) return 0;

        uint256 remainingCapUSD = lv.annualCapUSDC - m.claimedThisYear;

        uint256 coveredToken;
        uint256 coveredUSD;

        if (token == USDC) {
            // ── Path USDC: sin oracle, logica original ──────────────────────
            uint256 rawCoverage = (amount * lv.coverageBps) / BPS_DENOMINATOR;
            uint256 cappedUSD   = rawCoverage < remainingCapUSD
                ? rawCoverage : remainingCapUSD;
            coveredToken = cappedUSD < insuranceFundByToken[token]
                ? cappedUSD : insuranceFundByToken[token];
            if (coveredToken == 0) return 0;
            coveredUSD = coveredToken; // USDC: 1:1

        } else {
            // ── Path multi-token: requiere oracle ───────────────────────────
            // [NV-03 FIX] Sin oracle = cobertura 0. Seguro desde dia 1.
            // El cap annualCapUSDC esta calibrado para USDC (6 dec).
            // Comparar directamente contra montos de 18 dec produce coberturas incorrectas
            // y permite vaciar el fondo con $1 de dano real (AIONICO a $0.001 = 750 USDC por $1).
            address oracleAddr = priceOracles[token];
            if (oracleAddr == address(0)) return 0; // sin oracle = sin cobertura

            uint256 price;
            uint8   priceDec;
            try IPriceOracle(oracleAddr).getTokenPrice(token)
                returns (uint256 p, uint8 d) {
                price    = p;
                priceDec = d;
            } catch {
                return 0; // oracle falla = sin cobertura, nunca revertir
            }
            if (price == 0) return 0;

            uint8 tokenDec = 18; // WLD y AIONICO tienen 18 decimales

            // Aplicar coverageBps sobre el monto en token
            uint256 rawCoverToken = (amount * lv.coverageBps) / BPS_DENOMINATOR;

            // Convertir a USD para comparar con el cap calibrado en USDC
            uint256 rawCoverUSD = _convertToUSD(rawCoverToken, tokenDec, price, priceDec);

            // Aplicar cap en USD
            coveredUSD = rawCoverUSD < remainingCapUSD
                ? rawCoverUSD : remainingCapUSD;

            // Convertir de vuelta a token para la transferencia
            coveredToken = _convertFromUSD(coveredUSD, tokenDec, price, priceDec);

            // Limitar por fondo disponible en ese token
            if (coveredToken > insuranceFundByToken[token]) {
                coveredToken = insuranceFundByToken[token];
                // Recalcular USD real tras el ajuste por fondo
                coveredUSD = _convertToUSD(coveredToken, tokenDec, price, priceDec);
            }
            if (coveredToken == 0) return 0;
        }

        // ── Transferir al TrustCircle ──
        bool ok = IERC20(token).transfer(msg.sender, coveredToken);
        if (!ok) revert TransferFailed();

        insuranceFundByToken[token] -= coveredToken;

        // ── Actualizar estado (cap siempre en USD) ──
        m.claimedThisYear    += coveredUSD;
        totalClaimsThisCycle += coveredUSD;

        emit DeficitCovered(victim, defaulter, amount, coveredToken, circleId, cycle);
        return coveredToken;
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 3 — settleAnnualCycle (fin de año)
    // ══════════════════════════════════════════════════════

    /// @notice Ejecutar la distribución del excedente al fin del ciclo anual
    /// @dev Puede ser llamado por cualquiera después de que el ciclo haya terminado
    function settleAnnualCycle() external {
        if (block.timestamp < cycleStart + ANNUAL_CYCLE) revert CycleNotEnded();

        // ── Calcular excedente ──
        // Excedente = fondo actual + reserva anterior - nada más (ya se pagaron claims)
        uint256 surplus = insuranceFundByToken[USDC]; // [MC-07] ciclo anual opera en USDC

        if (surplus == 0) {
            // Sin excedente — solo avanzar ciclo
            _advanceCycle();
            return;
        }

        // ── Distribución del excedente ──
        uint256 toReserve   = (surplus * 20) / 100; // 20% reserva acumulativa
        uint256 toDev       = (surplus * 20) / 100; // 20% equipo de desarrollo
        uint256 toDiscount  = (surplus * 20) / 100; // 20% reducción de primas
        uint256 toRaffle    = surplus - toReserve - toDev - toDiscount; // 60% sorteo

        // Reserva acumulativa (se mantiene en el contrato)
        reserveBalance += toReserve;
        // [V-02 FIX] toDiscount queda en el fondo — se descuenta cuando se usa en subscribe()
        insuranceFundByToken[USDC] = toReserve + toDiscount; // [TC-B4-002 FIX] era reserveBalance — double-count

        // Fee al equipo
        if (toDev > 0) {
            bool ok = IERC20(USDC).transfer(DEV_WALLET, toDev);
            if (!ok) revert TransferFailed();
        }

        // Pool de descuento de primas
        premiumDiscountPool += toDiscount;

        emit AnnualCycleSettled(cycleNumber, surplus, toReserve, toDev, toDiscount, toRaffle);

        // ── Sorteo ──
        if (toRaffle > 0) {
            _executeRaffle(toRaffle);
        }

        _advanceCycle();
    }

    // ══════════════════════════════════════════════════════
    //  SORTEO ESCALATIVO DESCENDENTE
    // ══════════════════════════════════════════════════════

    /// @dev Selección de 8 ganadores (4 premios × 2) del pool de sorteo
    ///      Solo miembros elegibles (sin deuda, membresía activa)
    function _executeRaffle(uint256 pot) internal {
        // Construir lista de elegibles
        address[] memory eligible = _getEligibleMembers();
        if (eligible.length < 2) {
            // Sin ganadores suficientes — ir a reserva
            reserveBalance += pot;
            insuranceFundByToken[USDC] += pot; // [DS-02 FIX] mantener invariante contable
            return;
        }

        address[8] memory winners;
        uint256[8] memory amounts;

        uint256 remaining = pot;
        uint256 seed = uint256(keccak256(abi.encodePacked(
            block.timestamp, block.prevrandao, cycleNumber, eligible.length, block.number, msg.sender // [7.9 FIX] dificulta prediccion del seed
        )));

        // 4 premios, 2 ganadores cada uno
        // Premio N: 40% del remaining → 2 ganadores
        // Último premio (4to): restante completo → 2 ganadores
        for (uint256 prize = 0; prize < 4 && eligible.length >= 2; prize++) {
            uint256 prizePool;
            if (prize < 3) {
                prizePool = (remaining * 40) / 100;
            } else {
                prizePool = remaining; // 4to premio: todo lo que queda
            }

            uint256 perWinner = prizePool / 2;
            if (perWinner == 0) break;

            // Seleccionar 2 ganadores únicos ponderados por score
            (uint256 w1idx, uint256 w2idx) = _pickTwo(eligible, seed, prize);

            address w1 = eligible[w1idx];
            address w2 = eligible[w2idx];

            winners[prize * 2]     = w1;
            winners[prize * 2 + 1] = w2;
            amounts[prize * 2]     = perWinner;
            amounts[prize * 2 + 1] = prizePool - perWinner; // por si hay dust

            // Transferir premios
            if (perWinner > 0 && w1 != address(0)) {
                bool ok1 = IERC20(USDC).transfer(w1, perWinner);
                    if (!ok1) revert TransferFailed();

            }
            if ((prizePool - perWinner) > 0 && w2 != address(0)) {
                bool ok2 = IERC20(USDC).transfer(w2, prizePool - perWinner);
                    if (!ok2) revert TransferFailed();

            }

            remaining -= prizePool;
            seed = uint256(keccak256(abi.encodePacked(seed, prize)));
        }

        // Cualquier dust restante va a reserva
        if (remaining > 0) {
            reserveBalance += remaining;
        }

        DrawResult memory result = DrawResult({
            cycleNumber: cycleNumber,
            totalPot:    pot,
            winners:     winners,
            amounts:     amounts,
            timestamp:   block.timestamp
        });
        drawHistory.push(result);

        emit RaffleExecuted(cycleNumber, winners, amounts);
    }

    /// @dev Seleccionar 2 índices únicos ponderados por score
    function _pickTwo(address[] memory eligible, uint256 seed, uint256 round)
        internal view returns (uint256 idx1, uint256 idx2)
    {
        uint256 len = eligible.length;

        // Construir array de pesos por score
        uint256[] memory weights = new uint256[](len);
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < len; i++) {
            uint256 score = 1; // mínimo 1 ticket
            if (membershipContract != address(0)) {
                score += IMembershipContract(membershipContract).getScore(eligible[i]);
            }
            weights[i] = score;
            totalWeight += score;
        }

        // Selección ponderada — ganador 1
        uint256 rng1 = uint256(keccak256(abi.encodePacked(seed, round, "w1"))) % totalWeight;
        idx1 = _weightedSelect(weights, rng1, len);

        // Selección ponderada — ganador 2 (distinto del 1)
        uint256 remainingWeight = totalWeight - weights[idx1];
        if (remainingWeight == 0) {
            idx2 = (idx1 + 1) % len;
            return (idx1, idx2);
        }

        uint256 rng2 = uint256(keccak256(abi.encodePacked(seed, round, "w2"))) % remainingWeight;
        uint256 accum = 0;
        for (uint256 i = 0; i < len; i++) {
            if (i == idx1) continue;
            accum += weights[i];
            if (accum > rng2) {
                idx2 = i;
                return (idx1, idx2);
            }
        }
        // Fallback
        idx2 = idx1 == 0 ? 1 : 0;
    }

    function _weightedSelect(uint256[] memory weights, uint256 rng, uint256 len)
        internal pure returns (uint256 idx)
    {
        uint256 accum = 0;
        for (uint256 i = 0; i < len; i++) {
            accum += weights[i];
            if (accum > rng) return i;
        }
        return len - 1;
    }

    /// @dev Retorna miembros elegibles: membresía activa + sin deuda (según Contrato 3)
    function _getEligibleMembers() internal view returns (address[] memory) {
        uint256 count = 0;
        uint256 total = allMembers.length;

        for (uint256 i = 0; i < total; i++) {
            if (_isEligibleForRaffle(allMembers[i])) count++;
        }

        address[] memory result = new address[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < total; i++) {
            if (_isEligibleForRaffle(allMembers[i])) {
                result[j++] = allMembers[i];
            }
        }
        return result;
    }

    function _isEligibleForRaffle(address member) internal view returns (bool) {
        Membership storage m = memberships[member];
        // 1. Membresía activa
        if (m.expiresAt <= block.timestamp) return false;
        // 2. Sin deuda (Contrato 3)
        if (membershipContract != address(0)) {
            if (!IMembershipContract(membershipContract).isEligible(member)) return false;
        }
        return true;
    }

    function _advanceCycle() internal {
        cycleStart = block.timestamp;
        cycleNumber++;
        totalClaimsThisCycle   = 0;
        totalPremiumsThisCycle = 0;
    }

    // ── Helpers de conversion multi-token ────────────────────

    /// @dev [NV-03 FIX] Convierte amount en token a USD (6 decimales USDC)
    ///      Formula: amount * price / 10^(tokenDec + priceDec - 6)
    function _convertToUSD(
        uint256 amount,
        uint8   tokenDecimals,
        uint256 price,
        uint8   priceDecimals
    ) internal pure returns (uint256) {
        return (amount * price) / (10 ** (uint256(tokenDecimals) + priceDecimals - 6));
    }

    /// @dev [NV-03 FIX] Convierte amountUSD (6 decimales) a token
    ///      Formula: amountUSD * 10^(tokenDec + priceDec - 6) / price
    function _convertFromUSD(
        uint256 amountUSD,
        uint8   tokenDecimals,
        uint256 price,
        uint8   priceDecimals
    ) internal pure returns (uint256) {
        return (amountUSD * (10 ** (uint256(tokenDecimals) + priceDecimals - 6))) / price;
    }

    // ── Vistas públicas ──────────────────────────────────────

    /// @notice True si el miembro tiene membresía activa
    function hasMembership(address member) external view returns (bool) {
        return memberships[member].expiresAt > block.timestamp;
    }

    /// @notice Número de miembros totales registrados
    function totalMembersCount() external view returns (uint256) {
        return allMembers.length;
    }

    /// @notice Historial de sorteos
    function getDrawHistory() external view returns (DrawResult[] memory) {
        return drawHistory;
    }

    /// @notice Cuánto puede cubrir el seguro para este miembro en el año actual
    function remainingCoverage(address member) external view returns (uint256) {
        Membership storage m = memberships[member];
        if (m.expiresAt <= block.timestamp) return 0;
        Level memory lv = _levels[m.level];
        if (m.claimedThisYear >= lv.annualCapUSDC) return 0;
        return lv.annualCapUSDC - m.claimedThisYear;
    }

    /// @notice Tiempo restante hasta fin del ciclo anual
    function cycleTimeRemaining() external view returns (uint256) {
        uint256 end = cycleStart + ANNUAL_CYCLE;
        if (block.timestamp >= end) return 0;
        return end - block.timestamp;
    }
}
