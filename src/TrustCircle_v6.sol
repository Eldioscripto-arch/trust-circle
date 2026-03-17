// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  TrustCircle.sol — ROSCA Digital verificada con World ID
//  AIONICA Security Lab — v6.0 (arquitectura 3 contratos)
//  World Chain (EVM compatible, gas gratuito para usuarios)
// ============================================================
//
//  NOVEDADES v2.0:
//  [+] Multi-token: USDC + WLD + $AIONICO
//  [+] Fee 50% descuento si pagan con $AIONICO (0.5% vs 1%)
//  [+] Recompensas $AIONICO automáticas por buen comportamiento
//  [+] Cada pago a tiempo = 10 AIONICO
//  [+] Cada ciclo completado = 50 AIONICO al receptor
//  [+] ROSCA completa = 200 AIONICO a todos los miembros
//
//  REGLAS DE NEGOCIO:
//  [1] No-pago → el ciclo se salta, el miembro pierde su turno
//  [2] Orden de distribución → definido por el creador al crear
//  [3] Fee 1% USDC/WLD, 0.5% si el círculo usa AIONICO
// ============================================================

// ─── INTERFACES EXTERNAS ───────────────────────────────────

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWorldID {
    function verifyProof(
        uint256 root,
        uint256 groupId,
        uint256 signalHash,
        uint256 nullifierHash,
        uint256 externalNullifierHash,
        uint256[8] calldata proof
    ) external view;
}

interface IPermit2 {
    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }
    struct TokenPermissions {
        address token;
        uint256 amount;
    }
    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }
    function permitTransferFrom(
        PermitTransferFrom calldata permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;
}

/// @dev Interfaz mínima del token AIONICO para recompensas
interface IAionicoToken {
    function mintPaymentReward(address recipient) external;
    function mintCycleReward(address recipient) external;
    function mintRoscaReward(address recipient) external;
    function mintFirstCircleReward(address recipient) external;
}

/// @dev Interfaz del contrato de seguro de membresía (Contrato 2)
interface IMembershipInsurance {
    /// @notice Cubrir déficit de una víctima con membresía activa
    /// @param victim     quien recibe el pago del ciclo (afectado)
    /// @param defaulter  quien no pagó (causante del déficit)
    /// @param amount     monto del slot faltante
    /// @param circleId   id del círculo
    /// @param cycle      ciclo del incumplimiento
    /// @return covered   USDC realmente cubiertos y transferidos al TrustCircle
    function coverDeficit(
        address victim,
        address defaulter,
        uint256 amount,
        uint256 circleId,
        uint8   cycle,
        address token
    ) external returns (uint256 covered);
}

/// @dev Interfaz del contrato de membresía y scoring (Contrato 3)
interface IMembershipContract {

    /// @notice Registrar default y excluir al moroso
    function registerDefault(
        address defaulter,
        address victim,
        address token,
        uint256 amount,
        uint256 circleId,
        uint8   cycle
    ) external;

    /// @notice [C4 — v1.4] Registrar víctima para ventaja de posición
    function registerVictim(address victim) external;

    /// @notice Registrar ronda completada a tiempo (para scoring)
    function recordCompletedRound(address member) external;

    /// @notice True si el miembro puede unirse a nuevos círculos
    function isEligible(address member) external view returns (bool);

    /// @notice Score del miembro (para posición en distributionOrder)
    function getScore(address member) external view returns (uint256);

    function totalDebt(address member, address token) external view returns (uint256);
    function totalDebt(address member, uint256 circleId, address token) external view returns (uint256);
    // [NV-01 FIX] retorna monto real transferido a victimas para actualizar memberReceived
    function settleDebtFromPool(address defaulter, address token, uint256 amount, uint256 circleId) external returns (uint256 paidToVictims);
    // [NV-01 FIX correcto] pagos a victimas via FIFO — consultado en refund loop
    function victimReceivedFromPool(uint256 circleId, address victim) external view returns (uint256);
    function setActiveCircle(address member, uint256 circleId) external;
    function clearActiveCircle(address member) external;
    function activeCircleId(address member) external view returns (uint256);
    function earliestAllowedPosition(address member, uint8 totalMembers) external view returns (uint8);
}

// ─── CONTRATO PRINCIPAL ────────────────────────────────────

interface IAionicaVRF {
    function requestRandomness() external returns (uint256);
    function fulfillRandomness(uint256 requestId, uint256 randomWord, uint8 v, bytes32 r, bytes32 s) external;
    function isRequestFulfilled(uint256 requestId) external view returns (bool);
}
contract TrustCircle {

    // ── Tokens soportados en World Chain ───────────────────

    /// @dev USDC en World Chain
    address public constant USDC    = 0x79A02482A880bCE3F13e09Da970dC34db4CD24d1;

    /// @dev WLD en World Chain
    address public constant WLD     = 0x2cFc85d8E48F8EAB294be644d9E25C3030863003;

    /// @dev $AIONICO — se setea en constructor (deploy posterior)
    address public aionicoToken;

    /// @dev Tokens whitelisteados para círculos
    mapping(address => bool) public supportedTokens;

    // ── Contratos del protocolo ────────────────────────────
    address public constant PERMIT2  = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address public constant WORLD_ID = 0x17B354dD2595411ff79041f930e491A4Df39A278;

    string public constant APP_ID     = "app_da9a97ceb52e3ad29b347c4ebfeff06f";
    string public constant ACTION_JOIN = "join-circle-v1";

    // ── Parámetros del protocolo ───────────────────────────

    /// @dev Fee estándar: 1% (100 bps)
    uint256 public constant FEE_BPS_STANDARD = 100;
    address public constant DEV_WALLET = 0x5810D144BF4A5585aFA0B9dF4B6a3B6c08205137;

    /// @dev Fee con $AIONICO: 0.5% (50 bps) — incentivo al token propio
    uint256 public constant FEE_BPS_AIONICO  = 50;

    uint256 public constant BPS_DENOMINATOR  = 10_000;
    uint256 public constant MIN_CONTRIBUTION = 100_000; // 0.10 USDC (6 dec)
    uint8   public constant MAX_MEMBERS      = 20;
    uint256 public constant MIN_CYCLE_DURATION = 1 days;

    // ── Estado del contrato ────────────────────────────────

    address public immutable owner;
    IWorldID  public immutable worldId;
    IPermit2  public immutable permit2;

    uint256 public circleCount;

    /// @dev [TC6-001] Contrato 2 — seguro de membresía
    address public membershipInsurance;

    /// @dev [TC6-001] Contrato 3 — deuda, scoring, elegibilidad
    address public membershipContract;

    /// @dev Contrato VRF soberano para circulos abiertos
    address public vrf;

    /// @dev Mapeo requestId VRF -> circleId (para el nodo GitHub Action)
    mapping(uint256 => uint256) public vrfRequestToCircle;

    /// @dev Tracking de primeros círculos (para reward)
    mapping(address => bool) public hasCreatedCircle;

    /// @dev [TC-02 FIX] nullifier por círculo — previene bloqueo de identidad entre círculos
    mapping(uint256 => mapping(uint256 => bool)) public nullifierHashes; // circleId → nullifier

    // ── Estructuras de datos ───────────────────────────────

    enum CircleStatus { Open, Active, Completed, Cancelled }

    struct Circle {
        uint256 id;
        address creator;
        string  name;
        address token;               // USDC, WLD, o AIONICO
        uint256 contributionAmount;
        uint256 cycleDuration;
        uint8   maxMembers;
        uint8   memberCount;
        uint8   currentCycle;
        uint8   totalCycles;
        uint256 cycleStartTime;
        uint256 totalPoolBalance;
        CircleStatus status;
        address[] distributionOrder;
        address[] members;
        bool isOpen;
        uint256 vrfRequestId;
        uint256 randomSeed;
        bool randomnessFulfilled;
        uint256 creationTime;
    }

    struct CycleRecord {
        mapping(address => bool) hasPaid;
        bool distributed;
    }

    mapping(uint256 => Circle) public circles;
    mapping(uint256 => mapping(uint8 => CycleRecord)) private cycleRecords;
    mapping(address => uint256[]) public memberCircles;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => uint256)) public memberContributed;
    mapping(uint256 => mapping(address => uint256)) public memberReceived;

    // [MC-05] Standby acumulado por círculo para rondas futuras
    mapping(uint256 => uint256) public standbyPerCycle;

    // ── Eventos ────────────────────────────────────────────

    event CircleCreated(
        uint256 indexed circleId,
        address indexed creator,
        string name,
        address token,
        uint256 contributionAmount,
        uint8 maxMembers
    );
    event MemberJoined(uint256 indexed circleId, address indexed member, uint8 position);
    event CircleActivated(uint256 indexed circleId, uint256 cycleStartTime);
    event ContributionMade(uint256 indexed circleId, address indexed member, uint256 amount, uint8 cycle);
    event CycleDistributed(uint256 indexed circleId, uint8 indexed cycle, address indexed recipient, uint256 netAmount, uint256 fee);
    event MemberSkipped(uint256 indexed circleId, address indexed member, uint8 cycle);
    event CircleCompleted(uint256 indexed circleId);
    event MemberRefunded(uint256 indexed circleId, address indexed member, uint256 amount);
    event CircleCancelled(uint256 indexed circleId);
    event TokenAdded(address indexed token);
    event AionicoSet(address indexed token);
    event CircleRandomnessRequested(uint256 indexed circleId, uint256 requestId);
    event CircleRandomnessFulfilled(uint256 indexed circleId, uint256 randomSeed);
    event OpenCircleCancelled(uint256 indexed circleId);

    /// @dev [TC6-005] Emitido cuando un miembro no paga su ronda
    event MemberDefaulted(
        uint256 indexed circleId,
        uint8   indexed cycle,
        address indexed defaulter,
        address         victim,
        uint256         amount,
        bool            coveredByInsurance
    );

    // ── Errores ────────────────────────────────────────────

    error NotOwner();
    error CircleNotFound();
    error CircleNotOpen();
    error CircleNotActive();
    error NotMember();
    error AlreadyMember();
    error CircleFull();
    error InvalidContributionAmount();
    error InvalidCycleDuration();
    error InvalidMemberCount();
    error InvalidDistributionOrder();
    error AlreadyPaidThisCycle();
    error CycleNotEnded();
    error CycleAlreadyDistributed();
    error NullifierAlreadyUsed();
    error Unauthorized();
    error TransferFailed();
    error UnsupportedToken();
    error AionicoNotSet();
    error MemberExcluded();
    error PositionNotAllowed();
    error VRFNotSet();
    error RandomnessAlreadyFulfilled();
    error TimeoutNotReached();

    // ── Reentrancy guard ──────────────────────────────────
    /// @dev [TC3-001 FIX] Estado para nonReentrant modifier
    uint256 private _lockStatus; // 0=not entered, 1=entered  [V4-01 FIX: reset a 0]

    // ── Modificadores ──────────────────────────────────────

    modifier nonReentrant() {
        require(_lockStatus != 1, "TrustCircle: reentrant call"); // [TC3-001 FIX]
        _lockStatus = 1;
        _;
        _lockStatus = 0; // [V4-01 FIX] reset a 0, no a 2 — patrón OZ estándar
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier circleExists(uint256 circleId) {
        if (circleId == 0 || circleId > circleCount) revert CircleNotFound();
        _;
    }

    modifier onlyMember(uint256 circleId) {
        if (!isMember[circleId][msg.sender]) revert NotMember();
        _;
    }

    // ── Constructor ────────────────────────────────────────

    constructor() {
        owner   = msg.sender;
        worldId = IWorldID(WORLD_ID);
        permit2 = IPermit2(PERMIT2);

        // Tokens soportados desde el inicio
        supportedTokens[USDC] = true;
        supportedTokens[WLD]  = true;
    }

    // ── Admin ──────────────────────────────────────────────

    /// @notice Setear la dirección del token $AIONICO — [V3-01 FIX] solo una vez, no zero address
    function setAionicoToken(address _token) external onlyOwner {
        require(aionicoToken == address(0), "TrustCircle: AIONICO already set"); // [V3-01 FIX]
        require(_token != address(0),       "TrustCircle: zero address");        // [V3-01 FIX]
        aionicoToken = _token;
        supportedTokens[_token] = true;
        emit AionicoSet(_token);
    }

    /// @notice [TC6-001] Setear contrato de seguro — solo una vez
    function setMembershipInsurance(address _insurance) external onlyOwner {
        require(membershipInsurance == address(0), "TrustCircle: insurance already set");
        require(_insurance != address(0), "TrustCircle: zero address");
        membershipInsurance = _insurance;
    }

    /// @notice [TC6-001] Setear contrato de membresía — solo una vez
    function setMembershipContract(address _membership) external onlyOwner {
        require(membershipContract == address(0), "TrustCircle: membership already set");
        require(_membership != address(0), "TrustCircle: zero address");
        membershipContract = _membership;
    }

    /// @notice Setear contrato VRF — solo una vez
    function setVRF(address _vrf) external onlyOwner {
        require(vrf == address(0), "TrustCircle: VRF already set");
        require(_vrf != address(0), "TrustCircle: zero address");
        vrf = _vrf;
    }

    /// @notice Agregar tokens adicionales en el futuro
    function addSupportedToken(address _token) external onlyOwner {
        require(_token != address(0), "TrustCircle: zero address"); // [V4-03 FIX]
        supportedTokens[_token] = true;
        emit TokenAdded(_token);
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 1 — createCircle
    // ══════════════════════════════════════════════════════

    /// @notice Crea un nuevo Trust Circle
    /// @param token  Dirección del token (USDC, WLD, o AIONICO)
    function createCircle(
        string calldata name,
        address token,
        uint256 contributionAmount,
        uint256 cycleDuration,
        uint8 maxMembers,
        address[] calldata distributionOrder,
        bool isOpen
    ) external returns (uint256 circleId) {

        if (!supportedTokens[token]) revert UnsupportedToken();
        // [V3-02 FIX] MIN_CONTRIBUTION enforceada por token (empty if eliminado)
        if (token == USDC) {
            if (contributionAmount < MIN_CONTRIBUTION) revert InvalidContributionAmount();
        } else {
            if (contributionAmount == 0) revert InvalidContributionAmount();
        }
        if (cycleDuration < MIN_CYCLE_DURATION)  revert InvalidCycleDuration();
        if (maxMembers < 2 || maxMembers > MAX_MEMBERS) revert InvalidMemberCount();
        if (isOpen) {
            if (distributionOrder.length != 0) revert InvalidDistributionOrder();
            if (vrf == address(0)) revert VRFNotSet();
        } else {
            if (distributionOrder.length != maxMembers) revert InvalidDistributionOrder();
            for (uint8 i = 0; i < maxMembers; i++) {
                if (distributionOrder[i] == address(0)) revert InvalidDistributionOrder();
                for (uint8 j = i + 1; j < maxMembers; j++) {
                    if (distributionOrder[i] == distributionOrder[j]) revert InvalidDistributionOrder();
                }
            }
        }

        circleCount++;
        circleId = circleCount;

        Circle storage c = circles[circleId];
        c.id                 = circleId;
        c.creator            = msg.sender;
        c.name               = name;
        c.token              = token;
        c.contributionAmount = contributionAmount;
        c.cycleDuration      = cycleDuration;
        c.maxMembers         = maxMembers;
        c.memberCount        = 0;
        c.currentCycle       = 0;
        c.status             = CircleStatus.Open;
        c.isOpen             = isOpen;
        c.creationTime       = block.timestamp;

        if (!isOpen) {
            for (uint8 i = 0; i < maxMembers; i++) {
                c.distributionOrder.push(distributionOrder[i]);
            }
        } else {
            uint256 reqId = IAionicaVRF(vrf).requestRandomness();
            c.vrfRequestId = reqId;
            c.randomnessFulfilled = false;
            vrfRequestToCircle[reqId] = circleId;
            emit CircleRandomnessRequested(circleId, reqId);
        }

        emit CircleCreated(circleId, msg.sender, name, token, contributionAmount, maxMembers);

        // [TC-03 + TC2-007 FIX] Lógica unificada — siempre setea flag, reward si AIONICO disponible
        // Antes: else redundante causaba pérdida del reward si AIONICO se seteaba después
        if (!hasCreatedCircle[msg.sender]) {
        hasCreatedCircle[msg.sender] = true;
            if (aionicoToken != address(0)) {
                try IAionicoToken(aionicoToken).mintFirstCircleReward(msg.sender) {} catch {}
            }
        }

    // [MC-01] El creador no puede estar en otro circulo activo
        if (membershipContract != address(0)) {
            require(IMembershipContract(membershipContract).activeCircleId(msg.sender) == 0,
                "TrustCircle: ya en un circulo activo");
            // [MC-01-GAP FIX] Registrar al creador como activo desde Open
            // Evita que cree dos circulos antes de que alguno active
            try IMembershipContract(membershipContract).setActiveCircle(msg.sender, circleId) {} catch {}
        }
    return circleId;
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 2 — joinCircle (igual que v1, sin cambios)
    // ══════════════════════════════════════════════════════

    function joinCircle(
        uint256 circleId,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external circleExists(circleId) {

        Circle storage c = circles[circleId];

        if (c.status != CircleStatus.Open)    revert CircleNotOpen();
        if (c.memberCount >= c.maxMembers)    revert CircleFull();
        if (isMember[circleId][msg.sender])   revert AlreadyMember();

        if (c.isOpen) {
            // Circulo abierto: verificar posicion minima por score
            if (membershipContract != address(0)) {
                uint8 minPos = IMembershipContract(membershipContract)
                    .earliestAllowedPosition(msg.sender, c.maxMembers);
                if (c.memberCount < minPos) revert PositionNotAllowed();
            }
        } else {
            // Circulo cerrado: verificar que este en distributionOrder
            bool inOrder = false;
            for (uint8 i = 0; i < c.maxMembers; i++) {
                if (c.distributionOrder[i] == msg.sender) { inOrder = true; break; }
            }
            if (!inOrder) revert Unauthorized();
        }

        // [MC-01] Verificar que no esté en otro círculo activo
        if (membershipContract != address(0)) {
        uint256 activeId = IMembershipContract(membershipContract).activeCircleId(msg.sender);
            require(activeId == 0 || activeId == circleId,
                "TrustCircle: ya en un circulo activo"); // [MC-01-GAP-v2] permite unirse al propio circulo
        }

        // [TC6-003] Verificar elegibilidad — morosos excluidos no pueden unirse
        if (membershipContract != address(0)) {
            if (!IMembershipContract(membershipContract).isEligible(msg.sender))
                revert MemberExcluded();
        }

        if (nullifierHashes[circleId][nullifierHash]) revert NullifierAlreadyUsed(); // [TC-02 FIX]

        uint256 signalHash = uint256(keccak256(abi.encodePacked(msg.sender))) >> 8; // [7.14 FIX] World ID hashToField requiere >> 8
        uint256 externalNullifierHash = uint256(keccak256(abi.encodePacked(APP_ID, ACTION_JOIN, circleId))) >> 8; // [7.14 FIX] + [TC-02 FIX]

        worldId.verifyProof(root, 1, signalHash, nullifierHash, externalNullifierHash, proof);
        nullifierHashes[circleId][nullifierHash] = true; // [TC-02 FIX]

        c.members.push(msg.sender);
        c.memberCount++;
        isMember[circleId][msg.sender] = true;
        memberCircles[msg.sender].push(circleId);

        // Marcar miembro como activo en este circulo inmediatamente
        if (membershipContract != address(0)) {
            try IMembershipContract(membershipContract).setActiveCircle(msg.sender, circleId) {} catch {}
        }

        emit MemberJoined(circleId, msg.sender, c.memberCount - 1);

        if (c.memberCount == c.maxMembers) {
            if (!c.isOpen) {
                // Circulo cerrado: activar inmediatamente
                c.status         = CircleStatus.Active;
                c.totalCycles    = c.maxMembers;
                c.cycleStartTime = block.timestamp;
                emit CircleActivated(circleId, block.timestamp);
            } else if (c.randomnessFulfilled) {
                // [B7-H1 FIX] VRF respondio antes que el ultimo miembro — finalizar ahora
                _finalizeOpenCircle(circleId);
            }
            // Circulo abierto: espera randomness — activacion en _finalizeOpenCircle
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 3 — contribute (multi-token con Permit2)
    // ══════════════════════════════════════════════════════

    // [V4-02 FIX] nonReentrant + CEI: hasPaid y totalPoolBalance actualizados ANTES de Permit2
    function contribute(
        uint256 circleId,
        IPermit2.PermitTransferFrom calldata permit,
        bytes calldata signature
    ) external circleExists(circleId) onlyMember(circleId) nonReentrant {

        Circle storage c = circles[circleId];

        if (c.status != CircleStatus.Active) revert CircleNotActive();

        CycleRecord storage record = cycleRecords[circleId][c.currentCycle];
        if (record.hasPaid[msg.sender]) revert AlreadyPaidThisCycle();

        // El token del permit debe coincidir con el token del círculo
        require(permit.permitted.token == c.token, "TrustCircle: wrong token");
        require(permit.permitted.amount == c.contributionAmount, "TrustCircle: wrong amount");

        // [V4-02 FIX CEI] Estado actualizado ANTES de la llamada externa
        record.hasPaid[msg.sender] = true;
        c.totalPoolBalance += c.contributionAmount;
        memberContributed[circleId][msg.sender] += c.contributionAmount;

        // External call DESPUÉS de updates de estado
        permit2.permitTransferFrom(
            permit,
            IPermit2.SignatureTransferDetails({
                to: address(this),
                requestedAmount: c.contributionAmount
            }),
            msg.sender,
            signature
        );

        emit ContributionMade(circleId, msg.sender, c.contributionAmount, c.currentCycle);

        // [TC6-004] Registrar ronda completada para scoring (Contrato 3)
        if (membershipContract != address(0)) {
            try IMembershipContract(membershipContract).recordCompletedRound(msg.sender) {} catch {}
        }

        // Recompensa $AIONICO por pago a tiempo
        if (aionicoToken != address(0)) {
            try IAionicoToken(aionicoToken).mintPaymentReward(msg.sender) {} catch {}
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 4 — triggerDistribution
    //  Fee: 1% estándar / 0.5% si el círculo usa $AIONICO
    //  [TC6-002] Detecta morosos → seguro cubre víctima → registra deuda
    // ══════════════════════════════════════════════════════

    function triggerDistribution(uint256 circleId)
        external circleExists(circleId) onlyMember(circleId) nonReentrant // [TC3-001 FIX]
    {
        Circle storage c = circles[circleId];

        if (c.status != CircleStatus.Active) revert CircleNotActive();
        if (block.timestamp < c.cycleStartTime + c.cycleDuration) revert CycleNotEnded();

        CycleRecord storage record = cycleRecords[circleId][c.currentCycle];
        if (record.distributed) revert CycleAlreadyDistributed();

        address recipient  = _findRecipient(c, record);
        uint256 payerCount = _countPayers(c, record);
        uint256 grossAmount = payerCount * c.contributionAmount;

// [C2 — v1.4] Loop de morosos — Deuda Personalizada 75/7/18
        for (uint8 i = 0; i < c.members.length; i++) {
            address member = c.members[i];
            if (!record.hasPaid[member]) {

                // a) Calcular residual para el seguro (25% del faltante)
                //    El 75% queda comprometido como deuda hacia la víctima
                uint256 residual = (c.contributionAmount * 2500) / 10_000;

                // b) Cobertura de membresía — solo sobre el 25% residual
                uint256 covered = 0;
                if (membershipInsurance != address(0) && recipient != address(0)) {
                    try IMembershipInsurance(membershipInsurance).coverDeficit(
                        recipient,
                        member,
                        residual,
                        circleId,
                        c.currentCycle,
                        c.token
                    ) returns (uint256 _covered) {
                        covered = _covered;
                        if (covered > 0) grossAmount += covered;
                    } catch {}
                }

                // c) Registrar deuda personalizada con víctima
                if (membershipContract != address(0)) {
                    try IMembershipContract(membershipContract).registerDefault(
                        member,
                        recipient,
                        c.token,
                        c.contributionAmount,
                        circleId,
                        c.currentCycle
                    ) {} catch {}
                }

                // [C4 — v1.4] Registrar ventaja de posición para la víctima
                if (membershipContract != address(0)) {
                    try IMembershipContract(membershipContract).registerVictim(recipient) {} catch {}
                }

                // d) Evento
                emit MemberDefaulted(
                    circleId,
                    c.currentCycle,
                    member,
                    recipient,
                    c.contributionAmount,
                    covered > 0
                );

                emit MemberSkipped(circleId, member, c.currentCycle);
            }
        }

        // grossAmount == 0: nadie pagó Y el seguro no cubrió nada
        if (grossAmount == 0) {
            record.distributed = true; // [V3-04 FIX] consistencia histórica
            _advanceCycle(circleId, c);
            return;
        }

        // Fee reducido 50% si el círculo usa $AIONICO
        uint256 feeBps = (c.token == aionicoToken && aionicoToken != address(0))
            ? FEE_BPS_AIONICO
            : FEE_BPS_STANDARD;

        uint256 feeAmount = (grossAmount * feeBps) / BPS_DENOMINATOR;
        uint256 netAmount = grossAmount - feeAmount;

        // [CEI] record.distributed = true ANTES de cualquier transferencia externa
        record.distributed = true;

        IERC20 token = IERC20(c.token);

        // [MC-05] Neteo automático si el receptor tiene deuda en este círculo
        uint256 deudaRecipient = 0;
        if (membershipContract != address(0) && recipient != address(0)) {
            deudaRecipient = IMembershipContract(membershipContract).totalDebt(recipient, circleId, c.token);
        }

        if (deudaRecipient > 0) {
            // Fee sobre la ronda COMPLETA — el receptor responde por su ronda
            uint256 roundFull = uint256(c.maxMembers) * c.contributionAmount;
            uint256 feeRonda  = (roundFull * feeBps) / BPS_DENOMINATOR;
            // [H1 FIX] paraEl = lo disponible minus la deuda — no la contribucion historica
            uint256 disponible   = grossAmount > feeRonda ? grossAmount - feeRonda : 0;
            uint256 paraDeudas_a = disponible > deudaRecipient ? deudaRecipient : disponible;
            uint256 paraEl       = disponible - paraDeudas_a;

            // Fee ronda completa → DEV_WALLET
            if (feeRonda > 0) {
                bool feeOk = token.transfer(DEV_WALLET, feeRonda);
                if (!feeOk) revert TransferFailed();
            }

            // Lo que debe a víctimas desde el pozo
            uint256 paraDeudas = grossAmount > paraEl + feeRonda ? grossAmount - paraEl - feeRonda : 0;
            // [NV-05 FIX] Cap paraDeudas a la deuda real — el exceso va a standby
            if (membershipContract != address(0) && paraDeudas > 0) {
                uint256 deudaReal = IMembershipContract(membershipContract)
                    .totalDebt(recipient, circleId, c.token);
                if (paraDeudas > deudaReal) paraDeudas = deudaReal;
            }
            if (paraDeudas > 0 && membershipContract != address(0)) {
                // [NV-01 FIX correcto] settleDebtFromPool registra los pagos en
                // victimReceivedFromPool[circleId][victim] dentro de MembershipContract.
                // El refund loop consulta ese mapping directamente para cada miembro.
                // NO actualizar memberReceived[recipient] aqui — recipient es el deudor,
                // no la victima. Error anterior: actualizaba Bob con pagos que recibio Carol.
                try IMembershipContract(membershipContract).settleDebtFromPool(
                    recipient, c.token, paraDeudas, circleId
                ) returns (uint256) {} catch {}
            }

            // Sobrante → standby para rondas siguientes
            uint256 standby = grossAmount > paraEl + feeRonda + paraDeudas
                ? grossAmount - paraEl - feeRonda - paraDeudas : 0;
            if (standby > 0) {
                uint256 ciclosRestantes = c.totalCycles > c.currentCycle + 1
                    ? c.totalCycles - c.currentCycle - 1 : 1;
                standbyPerCycle[circleId] += (standby + ciclosRestantes - 1) / ciclosRestantes; // [DS-01 FIX] ceiling division — residuo no se pierde
            }

            // Pagar al moroso lo que le corresponde
            netAmount = paraEl;
        } else {
            // Ronda normal — sumar standby acumulado
            if (standbyPerCycle[circleId] > 0) {
                grossAmount += standbyPerCycle[circleId];
                standbyPerCycle[circleId] = 0;
                feeAmount = (grossAmount * feeBps) / BPS_DENOMINATOR;
                netAmount = grossAmount - feeAmount;
            }
            if (feeAmount > 0) {
                bool feeOk = token.transfer(DEV_WALLET, feeAmount); // [MC-04]
                if (!feeOk) revert TransferFailed();
            }
        }

        if (recipient != address(0) && netAmount > 0) {
            bool ok = token.transfer(recipient, netAmount);
            if (!ok) revert TransferFailed();
            memberReceived[circleId][recipient] += netAmount;
            emit CycleDistributed(circleId, c.currentCycle, recipient, netAmount, feeAmount);

            // Recompensa $AIONICO al receptor del ciclo
            if (aionicoToken != address(0)) {
                try IAionicoToken(aionicoToken).mintCycleReward(recipient) {} catch {}
            }
        }

        _advanceCycle(circleId, c);

// Si la ROSCA completa terminó → reintegro neto + reward
        if (c.status == CircleStatus.Completed) {
            for (uint8 i = 0; i < c.members.length; i++) {
                address member = c.members[i];
                uint256 contributed = memberContributed[circleId][member];
                uint256 received    = memberReceived[circleId][member];
                // [NV-01 FIX correcto] Sumar lo que esta victima cobro via settleDebtFromPool
                // Sin esto: Carol contributed=1000, received=0, refund=1000
                // Pero Carol ya cobro 562.5 via FIFO cuando fue la ronda del moroso
                // Resultado sin fix: Carol cobra 1562.5 — excess sale de otros circulos
                if (membershipContract != address(0)) {
                    received += IMembershipContract(membershipContract)
                        .victimReceivedFromPool(circleId, member);
                }
                uint256 debt = 0;
                if (membershipContract != address(0)) {
                    debt = IMembershipContract(membershipContract).totalDebt(member, circleId, c.token);
                }
                if (contributed > received + debt) {
                    uint256 refund = contributed - received - debt;
                    uint256 bal = IERC20(c.token).balanceOf(address(this));
                    if (refund > bal) refund = bal;
                    if (refund > 0) {
                        bool ok = IERC20(c.token).transfer(member, refund);
                        if (ok) emit MemberRefunded(circleId, member, refund);
                    }
                }
                if (aionicoToken != address(0)) {
                    try IAionicoToken(aionicoToken).mintRoscaReward(member) {} catch {}
                }
            }
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIÓN 5 — cancelCircle
    // ══════════════════════════════════════════════════════

    function cancelCircle(uint256 circleId) external circleExists(circleId) {
        Circle storage c = circles[circleId];
        if (msg.sender != c.creator) revert Unauthorized();
        if (c.status != CircleStatus.Open) revert CircleNotOpen();
        c.status = CircleStatus.Cancelled;
        // [B7-M3 FIX] Limpiar activeCircleId del creator (regresion MC-01-GAP B6)
        if (membershipContract != address(0)) {
            for (uint8 i = 0; i < c.members.length; i++) {
                try IMembershipContract(membershipContract).clearActiveCircle(c.members[i]) {} catch {}
            }
            // [NEW-M1 FIX] Limpiar creator — completa el loop de miembros
            try IMembershipContract(membershipContract).clearActiveCircle(c.creator) {} catch {}
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCIONES DE LECTURA
    // ══════════════════════════════════════════════════════

    function getCircle(uint256 circleId)
        external view circleExists(circleId)
        returns (
            uint256 id, address creator, string memory name,
            address token, uint256 contributionAmount,
            uint256 cycleDuration, uint8 maxMembers, uint8 memberCount,
            uint8 currentCycle, uint256 cycleStartTime, CircleStatus status
        )
    {
        Circle storage c = circles[circleId];
        return (c.id, c.creator, c.name, c.token, c.contributionAmount,
                c.cycleDuration, c.maxMembers, c.memberCount,
                c.currentCycle, c.cycleStartTime, c.status);
    }

    function getDistributionOrder(uint256 circleId)
        external view circleExists(circleId) returns (address[] memory)
    { return circles[circleId].distributionOrder; }

    function hasPaidCurrentCycle(uint256 circleId, address member)
        external view circleExists(circleId) returns (bool)
    {
        Circle storage c = circles[circleId];
        return cycleRecords[circleId][c.currentCycle].hasPaid[member];
    }

    function getMemberCircles(address member)
        external view returns (uint256[] memory)
    { return memberCircles[member]; }

    function cycleEndsAt(uint256 circleId)
        external view circleExists(circleId) returns (uint256)
    {
        Circle storage c = circles[circleId];
        return c.cycleStartTime + c.cycleDuration;
    }

    function projectedFee(uint256 circleId)
        external view circleExists(circleId)
        returns (uint256 feeUSDC, uint256 netUSDC, uint256 feeBps)
    {
        Circle storage c = circles[circleId];
        uint256 gross = uint256(c.maxMembers) * c.contributionAmount;
        feeBps  = (c.token == aionicoToken && aionicoToken != address(0))
            ? FEE_BPS_AIONICO : FEE_BPS_STANDARD;
        feeUSDC = (gross * feeBps) / BPS_DENOMINATOR;
        netUSDC = gross - feeUSDC;
    }

    /// @notice Ver todos los tokens soportados actualmente
    function isTokenSupported(address token) external view returns (bool) {
        return supportedTokens[token];
    }

    /// @notice [TC2-008 FIX] Getter para estado de ciclo — útil para UIs e integradores
    function getCycleRecord(uint256 circleId, uint8 cycle)
        external view circleExists(circleId)
        returns (bool distributed, address[] memory payers, uint256 payerCount)
    {
        Circle storage c = circles[circleId];
        CycleRecord storage record = cycleRecords[circleId][cycle];
        distributed = record.distributed;
        // Construir lista de pagadores
        address[] memory temp = new address[](c.members.length);
        uint256 count = 0;
        for (uint256 i = 0; i < c.members.length; i++) {
            if (record.hasPaid[c.members[i]]) {
                temp[count] = c.members[i];
                count++;
            }
        }
        payers = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            payers[i] = temp[i];
        }
        payerCount = count;
    }

    // ── Funciones internas ─────────────────────────────────

    /// @dev [TC-01 FIX] Busca en TODOS los índices, no solo los posteriores al ciclo
    /// Previene bloqueo permanente de fondos cuando pagadores están en posiciones < ciclo actual
function _findRecipient(Circle storage c, CycleRecord storage /*record*/)
        internal view returns (address)
    {
        // [C1 — v1.4] El recipient es SIEMPRE el miembro al que le corresponde
        // por posición en distributionOrder. Nunca se salta, nunca se redirige.
        // Ningún miembro puede cobrar más de una vez.
        return c.distributionOrder[c.currentCycle];
    }

    function _countPayers(Circle storage c, CycleRecord storage record)
        internal view returns (uint256 count)
    {
        for (uint8 i = 0; i < c.maxMembers; i++) {
            if (record.hasPaid[c.members[i]]) count++;
        }
    }

    function _advanceCycle(uint256 circleId, Circle storage c) internal {
        c.currentCycle++;
        c.totalPoolBalance = 0;
        c.cycleStartTime   = block.timestamp;
        if (c.currentCycle >= c.totalCycles) {
            c.status = CircleStatus.Completed;
            // [MC-01] Liberar círculo activo para todos los miembros
            if (membershipContract != address(0)) {
                for (uint8 i = 0; i < c.members.length; i++) {
                    try IMembershipContract(membershipContract).clearActiveCircle(c.members[i]) {} catch {}
                }
            }
            emit CircleCompleted(circleId);
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCION — fulfillCircleRandomness
    // ══════════════════════════════════════════════════════

    /// @notice El nodo VRF entrega la aleatoriedad para activar un circulo abierto
    function fulfillCircleRandomness(
        uint256 circleId,
        uint256 randomWord,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external circleExists(circleId) {
        Circle storage c = circles[circleId];
        require(c.isOpen, "TrustCircle: only open circles");
        if (c.randomnessFulfilled) revert RandomnessAlreadyFulfilled();
        require(c.vrfRequestId != 0, "TrustCircle: no VRF request");
        require(vrf != address(0), "TrustCircle: VRF not set");

        IAionicaVRF(vrf).fulfillRandomness(c.vrfRequestId, randomWord, v, r, s);

        c.randomSeed = randomWord;
        c.randomnessFulfilled = true;
        emit CircleRandomnessFulfilled(circleId, randomWord);

        if (c.memberCount == c.maxMembers) {
            _finalizeOpenCircle(circleId);
        }
    }

    // ══════════════════════════════════════════════════════
    //  FUNCION — cancelOpenCircle (timeout 7 dias)
    // ══════════════════════════════════════════════════════

    /// @notice Cancela un circulo abierto si el VRF no respondio en 7 dias
    function cancelOpenCircle(uint256 circleId) external circleExists(circleId) {
        Circle storage c = circles[circleId];
        require(c.isOpen, "TrustCircle: only open circles");
        if (msg.sender != c.creator) revert Unauthorized();
        if (c.status != CircleStatus.Open) revert CircleNotOpen();
        if (block.timestamp <= c.creationTime + 7 days) revert TimeoutNotReached();

        if (membershipContract != address(0)) {
            for (uint8 i = 0; i < c.members.length; i++) {
                try IMembershipContract(membershipContract).clearActiveCircle(c.members[i]) {} catch {}
            }
            // [B7-M2 FIX] Limpiar creator si no se unio como miembro
            if (!isMember[circleId][c.creator]) {
                try IMembershipContract(membershipContract).clearActiveCircle(c.creator) {} catch {}
            }
        }
        c.status = CircleStatus.Cancelled;
        emit OpenCircleCancelled(circleId);
    }

    // ── Funciones internas — circulos abiertos ─────────────

    function _finalizeOpenCircle(uint256 circleId) internal {
        Circle storage c = circles[circleId];
        require(c.isOpen, "Not open");
        require(c.randomnessFulfilled, "Randomness missing");
        require(c.memberCount == c.maxMembers, "Not full");
        require(c.status == CircleStatus.Open, "Already active or cancelled");

        uint8 n = c.maxMembers;
        address[] memory members = c.members;
        uint8[] memory minPos = new uint8[](n);

        if (membershipContract != address(0)) {
            for (uint8 i = 0; i < n; i++) {
                minPos[i] = IMembershipContract(membershipContract)
                    .earliestAllowedPosition(members[i], n);
            }
        }

        address[] memory order = _assignRandomPositions(members, minPos, c.randomSeed, n);

        delete c.distributionOrder;
        for (uint8 i = 0; i < n; i++) {
            c.distributionOrder.push(order[i]);
        }

        c.status = CircleStatus.Active;
        c.totalCycles = n;
        c.cycleStartTime = block.timestamp;
        emit CircleActivated(circleId, block.timestamp);
    }

    function _assignRandomPositions(
        address[] memory members,
        uint8[] memory minPos,
        uint256 seed,
        uint8 n
    ) internal pure returns (address[] memory) {
        uint256[] memory rand = new uint256[](n);
        for (uint8 i = 0; i < n; i++) {
            rand[i] = uint256(keccak256(abi.encodePacked(seed, members[i])));
        }

        for (uint8 i = 0; i < n; i++) {
            for (uint8 j = i + 1; j < n; j++) {
                if (rand[i] > rand[j]) {
                    (members[i], members[j]) = (members[j], members[i]);
                    (rand[i], rand[j]) = (rand[j], rand[i]);
                    (minPos[i], minPos[j]) = (minPos[j], minPos[i]);
                }
            }
        }

        bool[] memory taken = new bool[](n);
        address[] memory result = new address[](n);

        for (uint8 i = 0; i < n; i++) {
            address member = members[i];
            uint8 pos = minPos[i];
            while (pos < n && taken[pos]) { pos++; }
            if (pos >= n) {
                // [B7-M1 FIX] Fallback: primera posicion libre desde 0
                // Solo ocurre cuando todos tienen el mismo score — el orden aleatorio sigue siendo justo
                pos = 0;
                while (pos < n && taken[pos]) { pos++; }
            }
            require(pos < n, "TrustCircle: position assignment impossible");
            result[pos] = member;
            taken[pos] = true;
        }
        return result;
    }
}
