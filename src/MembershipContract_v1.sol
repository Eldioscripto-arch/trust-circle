// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  MembershipContract.sol — Contrato 3
//  AIONICA Security Lab — v1.0
//  World Chain (EVM compatible)
//  World Chain (EVM compatible)
// ============================================================
//
//  RESPONSABILIDADES:
//  [1] Registrar deudas de morosos (llamado por TrustCircle)
//  [2] Gestionar exclusión/elegibilidad para nuevos círculos
//  [3] Tracking de scoring por rondas cumplidas
//  [4] Rehabilitación mediante pago de deuda
//  [5] Historial de incumplimientos on-chain
//
//  DISTRIBUCIÓN DE PAGO DE DEUDA (settleDebt):
//  → 20% al equipo de desarrollo — 0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137
//  → 80% al fondo de seguro (repone liquidez para futuras coberturas)
//
//  REGLAS:
//  → Default inmediato → excluded = true
//  → Para rehabilitarse: pagar deuda completa por token
//  → Score sube por rondas cumplidas, penalizado por defaults
//  → Score determina posición máxima permitida en círculo
// ============================================================

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MembershipContract {

    // ── Roles y destinos de fondos ──────────────────────────

    address public immutable owner;

    /// @dev Solo TrustCircle puede registrar defaults y rondas
    address public trustCircle;

    /// @dev Fondo de seguro — destino del 80% de los pagos de deuda
    address public insuranceFund;

    /// @dev Wallet del equipo de desarrollo — 20% de cada pago de deuda
    /// World Chain: 0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137
    address public constant DEV_WALLET = 0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137;

    /// @dev 20% de cada pago de deuda va al equipo
    uint256 public constant DEV_FEE_BPS     = 2000;

    // [C2 — v1.4] Split de deuda personalizada
    uint256 public constant VICTIM_BPS    = 7500; // 75% → víctima cuando moroso paga
    uint256 public constant DEBT_DEV_BPS  =  700; // 7%  → DEV_WALLET
    uint256 public constant DEBT_FUND_BPS = 1800; // 18% → fondo de garantía
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ── Scoring ─────────────────────────────────────────────

    /// @dev Rondas completadas a tiempo (pago on-time)
    mapping(address => uint256) public completedRounds;

    /// @dev Número total de defaults acumulados (no se borra al rehabilitar)
    mapping(address => uint256) public defaultCount;

    // ── Deuda por token ─────────────────────────────────────

    /// @dev debt[member][token] = monto adeudado en ese token
    mapping(address => mapping(address => uint256)) public debt;

    mapping(address => mapping(uint256 => mapping(address => uint256))) public debtByCircle;

    /// @dev Número de tokens con deuda > 0 (para isEligible eficiente)
    mapping(address => uint256) private _debtTokenCount;

    /// @dev excluded[member] = true si tiene alguna deuda pendiente
    mapping(address => bool) public excluded;

    // ── Historial ────────────────────────────────────────────

    struct DefaultRecord {
        uint256 circleId;
        uint8   cycle;
        address token;
        uint256 amount;
        uint256 timestamp;
        bool    settled;
        address victim;   // [C2 — v1.4] víctima de este default específico
    }

    mapping(address => DefaultRecord[]) private _defaultHistory;

    /// @dev [C2 — v1.4] víctima más reciente por deudor y token
    mapping(address => mapping(address => address)) public debtVictim;

    // [MC-03] Array FIFO de deudas con víctimas específicas
    struct DebtEntry {
        address victim;
        uint256 amount;
        uint256 circleId;
        bool    settled;
    }
    mapping(address => mapping(address => DebtEntry[])) public debtLedger;

    /// @dev [C4 — v1.4] registro de que fue víctima en su último círculo
    ///      Se consume (false) una vez que se usa la ventaja de posición
    mapping(address => uint256) public victimCount;

    // [MC-01] Un usuario, un círculo activo
    mapping(address => uint256) public activeCircleId;

    // [NV-01 FIX correcto] Pagos a victimas via settleDebtFromPool, por circulo
    // TrustCircle lo consulta en el refund loop para no sobre-reembolsar a victimas
    // que ya cobraron su 75% cuando el moroso recibio su ronda
    mapping(uint256 => mapping(address => uint256)) public victimReceivedFromPool;

    // ── Eventos ──────────────────────────────────────────────

    event TrustCircleSet(address indexed trustCircle);
    event InsuranceFundSet(address indexed fund);
    event DefaultRegistered(
        address indexed defaulter,
        address indexed token,
        uint256 amount,
        uint256 indexed circleId,
        uint8   cycle
    );
    event DebtSettled(
        address indexed member,
        address indexed token,
        uint256 amount,
        uint256 remainingDebt
    );
    event MemberRehabilitated(address indexed member);
    event RoundRecorded(address indexed member, uint256 totalCompleted);

    // ── Errores ──────────────────────────────────────────────

    error NotOwner();
    error NotTrustCircle();
    error AlreadySet();
    error ZeroAddress();
    error ZeroAmount();
    error DebtExceeded();
    error InsuranceFundNotSet();

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
        owner = msg.sender;
    }

    // ── Admin ─────────────────────────────────────────────────

    /// @notice Setear TrustCircle — solo una vez
    function setTrustCircle(address _tc) external onlyOwner {
        if (trustCircle != address(0)) revert AlreadySet();
        if (_tc == address(0)) revert ZeroAddress();
        trustCircle = _tc;
        emit TrustCircleSet(_tc);
    }

    /// @notice Setear fondo de seguro — destino de pagos de deuda
    function setInsuranceFund(address _fund) external onlyOwner {
        if (_fund == address(0)) revert ZeroAddress();
        insuranceFund = _fund;
        emit InsuranceFundSet(_fund);
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIONES LLAMADAS POR TRUSTCIRCLE
    // ══════════════════════════════════════════════════════

    /// @notice Registrar default y excluir al moroso — solo TrustCircle
    /// @param defaulter  quien no pagó
    /// @param token      token del círculo
    /// @param amount     monto de la ronda no pagada
    /// @param circleId   círculo donde ocurrió
    /// @param cycle      ciclo del incumplimiento
    function registerDefault(
        address defaulter,
        address victim,    // [C2 — v1.4] quién fue perjudicado este ciclo
        address token,
        uint256 amount,
        uint256 circleId,
        uint8   cycle
    ) external onlyTrustCircle {
        if (defaulter == address(0)) revert ZeroAddress();
        if (victim == address(0))    revert ZeroAddress();
        if (token == address(0))     revert ZeroAddress();
        if (amount == 0)             revert ZeroAmount();

        if (debt[defaulter][token] == 0) {
            _debtTokenCount[defaulter]++;
        }

        debt[defaulter][token] += amount;
        debtByCircle[defaulter][circleId][token] += amount;
        defaultCount[defaulter]++;
        excluded[defaulter] = true;

        // [C2 — v1.4] Guardar víctima más reciente para este token
        debtVictim[defaulter][token] = victim;

        debtLedger[defaulter][token].push(DebtEntry({victim: victim, amount: amount, circleId: circleId, settled: false}));

        _defaultHistory[defaulter].push(DefaultRecord({
            circleId:  circleId,
            cycle:     cycle,
            token:     token,
            amount:    amount,
            timestamp: block.timestamp,
            settled:   false,
            victim:    victim  // [C2 — v1.4]
        }));

        emit DefaultRegistered(defaulter, token, amount, circleId, cycle);
    }

    /// @notice [C4 — v1.4] Registrar que este miembro fue víctima — solo TrustCircle
    function registerVictim(address victim) external onlyTrustCircle {
        if (victim == address(0)) revert ZeroAddress();
        victimCount[victim]++;
    }

    function setActiveCircle(address member, uint256 circleId)
        external onlyTrustCircle {
        activeCircleId[member] = circleId;
    }

    function clearActiveCircle(address member)
        external onlyTrustCircle {
        activeCircleId[member] = 0;
    }

    /// @notice Registrar ronda completada a tiempo — solo TrustCircle
    /// @dev Llamado desde contribute() cuando el miembro paga en tiempo
    function recordCompletedRound(address member) external onlyTrustCircle {
        if (member == address(0)) revert ZeroAddress();
        completedRounds[member]++;
        emit RoundRecorded(member, completedRounds[member]);
    }

    // ══════════════════════════════════════════════════════
    //  PAGO DE DEUDA Y REHABILITACIÓN
    // ══════════════════════════════════════════════════════

/// @notice Pagar deuda en un token específico para rehabilitación
    /// @param token  token de la deuda
    /// @param amount monto a pagar (puede ser parcial)
    /// @dev [C2 — v1.4] Split: 75% víctima, 7% DEV, 18% fondo de garantía
    function settleDebt(address token, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (insuranceFund == address(0)) revert InsuranceFundNotSet();

        uint256 currentDebt = debt[msg.sender][token];
        if (amount > currentDebt) revert DebtExceeded();

        // [C2 — v1.4] Split: 75% víctima + 7% DEV + 18% fondo
        uint256 victimShare = (amount * VICTIM_BPS)    / BPS_DENOMINATOR;
        uint256 devShare    = (amount * DEBT_DEV_BPS)  / BPS_DENOMINATOR;
        uint256 fundShare   = amount - victimShare - devShare; // 18% exacto, sin residuo perdido

        // Recibir tokens del moroso
        bool ok = IERC20(token).transferFrom(msg.sender, address(this), amount);
        require(ok, "MembershipContract: transfer failed");

        // 75% → víctima registrada para este token
        // [MC-03] Pago FIFO a múltiples víctimas
        uint256 remaining = victimShare;
        DebtEntry[] storage entries = debtLedger[msg.sender][token];
        for (uint256 i = 0; i < entries.length && remaining > 0; i++) {
            if (!entries[i].settled) {
                uint256 share = remaining >= entries[i].amount ? entries[i].amount : remaining;
                entries[i].amount -= share;
                if (entries[i].amount == 0) entries[i].settled = true;
                remaining -= share;
                // [NV-02 FIX] Sincronizar debtByCircle — sin esto totalDebt(member,circleId,token)
                // devuelve valor obsoleto y triggerDistribution toma el path de moroso aunque ya pago
                // [AT-B6-011 FIX] reducir debtByCircle por monto total proporcional
                // share es victimShare (75%) — debtByCircle debe reducir por el 100% equivalente
                uint256 fullPaid = (share * BPS_DENOMINATOR) / VICTIM_BPS;
                uint256 dbcCurrent = debtByCircle[msg.sender][entries[i].circleId][token];
                debtByCircle[msg.sender][entries[i].circleId][token] -= fullPaid < dbcCurrent ? fullPaid : dbcCurrent;
                    if (share > 0) {
                    // [V-03 FIX] graceful failure — victim maliciosa no bloquea a las demas
                    (bool ok,) = token.call(
                        abi.encodeWithSignature("transfer(address,uint256)", entries[i].victim, share)
                    );
                    if (!ok) {
                        // Fondo de garantia absorbe — victima puede reclamar via settleDebt directo
                        fundShare += share;
                    } else {
                        // [NV-04 FIX] Registrar pago a victima para evitar over-refund al cierre
                        victimReceivedFromPool[entries[i].circleId][entries[i].victim] += share;
                    }
                }
            }
        }
        if (remaining > 0) fundShare += remaining;

        // 7% → equipo
        if (devShare > 0) {
            bool devOk = IERC20(token).transfer(DEV_WALLET, devShare);
            require(devOk, "MembershipContract: dev transfer failed");
        }

        // 18% → fondo de garantía
        if (fundShare > 0) {
            bool fundOk = IERC20(token).transfer(insuranceFund, fundShare);
            require(fundOk, "MembershipContract: fund transfer failed");
        }

        debt[msg.sender][token] = currentDebt - amount;

        if (debt[msg.sender][token] == 0) {
            _debtTokenCount[msg.sender]--;
            _markSettled(msg.sender, token, amount);
        }

        uint256 remainingDebt = debt[msg.sender][token];
        emit DebtSettled(msg.sender, token, amount, remainingDebt);

        if (_debtTokenCount[msg.sender] == 0) {
            excluded[msg.sender] = false;
            emit MemberRehabilitated(msg.sender);
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIONES DE CONSULTA — usadas por TrustCircle
    // ══════════════════════════════════════════════════════

    /// @notice True si el miembro puede unirse a nuevos círculos
    function isEligible(address member) external view returns (bool) {
        return !excluded[member];
    }

    /// @notice Score efectivo del miembro (considera penalidades por defaults)
    /// @dev Score escalonado:
    ///   0–2  rondas → score base 0
    ///   3–5          → score base 1
    ///   6–10         → score base 2
    ///   11–20        → score base 3
    ///   21+          → score base 4
    ///   Cada default activo (sin rehabilitar) resta 1 punto
    function getScore(address member) external view returns (uint256) {
        uint256 base = _baseScore(completedRounds[member]);
        // Solo penalizar por defaults actuales (no históricos ya saldados)
        uint256 activeDefaults = excluded[member] ? defaultCount[member] : 0;
        return base > activeDefaults ? base - activeDefaults : 0;
    }

    /// @notice Posición más temprana permitida (0-indexed) en un círculo de totalMembers
    /// @dev Score alto → puede ir primero. Score bajo → va al final.
    ///      Retorna el índice MÍNIMO donde puede aparecer en distributionOrder.
    function earliestAllowedPosition(address member, uint8 totalMembers)
        external view returns (uint8)
    {
        uint256 score = this.getScore(member);
        if (totalMembers == 0) return 0;

        // [C4 — v1.4] Víctima sin cobrar → puede ir una posición antes de lo normal
        uint8 base;
        if (score >= 4) base = totalMembers / 4;
        else if (score == 3) base = 0;
        else if (score == 2) base = totalMembers / 2;
        else if (score == 1) base = (totalMembers * 3) / 4;
        else base = totalMembers - 1;

        if (victimCount[member] > 0 && base > 0) {
            uint256 adv = victimCount[member];
            base = base > adv ? uint8(base - adv) : 0;
        }
        return base;
    }

    /// @notice [MC-05] Liquidar deuda desde el pozo — llamado por TrustCircle
    /// @return paidToVictims monto real transferido exitosamente a victimas (excluye devShare y fundShare)
    /// [NV-01 FIX] TrustCircle usa este valor para actualizar memberReceived y evitar double-pay al cierre
    function settleDebtFromPool(
        address defaulter,
        address token,
        uint256 amount,
        uint256 circleId
    ) external onlyTrustCircle returns (uint256 paidToVictims) {
        if (amount == 0) return 0;
        uint256 currentDebt = debt[defaulter][token];
        if (currentDebt == 0) return 0;
        uint256 toPay = amount > currentDebt ? currentDebt : amount;

        // Split 75/7/18 desde el pozo
        uint256 victimShare = (toPay * VICTIM_BPS)   / BPS_DENOMINATOR;
        uint256 devShare    = (toPay * DEBT_DEV_BPS) / BPS_DENOMINATOR;
        uint256 fundShare   = toPay - victimShare - devShare;

        // FIFO a víctimas
        uint256 remaining = victimShare;
        DebtEntry[] storage entries = debtLedger[defaulter][token];
        for (uint256 i = 0; i < entries.length && remaining > 0; i++) {
            if (!entries[i].settled) {
                uint256 share = remaining >= entries[i].amount ? entries[i].amount : remaining;
                entries[i].amount -= share;
                if (entries[i].amount == 0) entries[i].settled = true;
                remaining -= share;
                if (share > 0) {
                // [V-03 FIX] graceful failure — victim maliciosa no bloquea a las demas
                    (bool ok,) = token.call(
                        abi.encodeWithSignature("transfer(address,uint256)", entries[i].victim, share)
                    );
                    if (!ok) {
                        fundShare += share;
                    } else {
                        paidToVictims += share; // [NV-01 FIX] acumular para retorno
                        victimReceivedFromPool[entries[i].circleId][entries[i].victim] += share; // [NV-01 FIX correcto]
                    }
                }
            }
        }
        if (remaining > 0) fundShare += remaining;

        if (devShare > 0) {
            bool devOk = IERC20(token).transfer(DEV_WALLET, devShare);
            require(devOk, "MembershipContract: dev transfer failed"); // [QA-7.12 FIX]
        }
        if (fundShare > 0) {
            bool fundOk = IERC20(token).transfer(insuranceFund, fundShare);
            require(fundOk, "MembershipContract: fund transfer failed"); // [QA-7.12 FIX]
        }

        debt[defaulter][token] -= toPay;
        debtByCircle[defaulter][circleId][token] =
            debtByCircle[defaulter][circleId][token] > toPay
            ? debtByCircle[defaulter][circleId][token] - toPay : 0;

        if (debt[defaulter][token] == 0) {
            _debtTokenCount[defaulter]--;
            _markSettled(defaulter, token, toPay);
            if (_debtTokenCount[defaulter] == 0) {
                excluded[defaulter] = false;
                emit MemberRehabilitated(defaulter);
            }
        }
    }

    /// @notice Historial de defaults del miembro
    function getDefaultHistory(address member)
        external view
        returns (DefaultRecord[] memory)
    {
        return _defaultHistory[member];
    }

    /// @notice Resumen de deuda total en un token específico
    function totalDebt(address member, address token)
        external view returns (uint256)
    {
        return debt[member][token];
    }

    /// @notice Deuda de un miembro en un círculo específico — [MC-02]
    function totalDebt(address member, uint256 circleId, address token)
        external view returns (uint256)
    {
        return debtByCircle[member][circleId][token];
    }

    // ── Funciones internas ────────────────────────────────

    function _baseScore(uint256 rounds) internal pure returns (uint256) {
        if (rounds >= 21) return 4;
        if (rounds >= 11) return 3;
        if (rounds >= 6)  return 2;
        if (rounds >= 3)  return 1;
        return 0;
    }

    function _markSettled(address member, address token, uint256 paidAmount) internal {
        uint256 remaining = paidAmount;
        DefaultRecord[] storage history = _defaultHistory[member];
        for (uint256 i = 0; i < history.length && remaining > 0; i++) {
            if (history[i].token == token && !history[i].settled) {
                if (remaining >= history[i].amount) {
                    remaining -= history[i].amount;
                    history[i].settled = true;
                } else {
                    // Pago parcial — marcar solo si cubre el monto
                    break;
                }
            }
        }
    }
}
