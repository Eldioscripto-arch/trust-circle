// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  AionicoToken.sol — Token nativo del ecosistema Trust Circle
//  Símbolo: $AIONICO
//  AIONICA Security Lab — v5.1 (FINAL CERTIFICADO — score 96/100)
//  World Chain (EVM compatible)
// ============================================================
//
//  CHANGELOG v2.0:
//  [AT-001 FIXED] trustCircleContract seteado en constructor — no setter
//  [AT-002 FIXED] Cliff de 6 meses antes del vesting lineal
//  [AT-003 FIXED] Pause de emergencia en rewards
//  [AT-004 FIXED] Check from != address(0) en _transfer
//  [AT-005 INFO]  Eventos iniciales documentados como asignaciones
//
//  CHANGELOG v3.0 (AIONICA Audit Round 2 — KIMI + DeepSeek + Claude):
//  [V-01  FIXED] _mintReward bloquea recipient == address(this)
//  [V-02  FIXED] transferOwnership emite OwnershipTransferred
//  [V-03  FIXED] claimTeamVesting accesible también por teamVestingWallet
//  [V-04  FIXED] transferOwnership two-step (pendingOwner + acceptOwnership)
//  [AT2-001 FIXED] Vesting: cap explícito cuando elapsed >= VESTING_DURATION
//  [AT2-003 FIXED] rewardsBalance separado del balance del contrato
//
//  CHANGELOG v4.0 (AIONICA Audit Round 3 — KIMI + Claude):
//  [V3-01  FIXED] cancelOwnershipTransfer() — pendingOwner cancelable
//  [V3-02  FIXED] rewardsRemaining() usa rewardsBalance (única fuente de verdad)
//  [V3-03  FIXED] pauseRewards/unpauseRewards verifican estado antes de emitir
//  [V3-04  FIXED] error NotAuthorized para claimTeamVesting (semántica correcta)
//  [AT3-001 FIXED] Vesting con precisión escalada — sin dust por reclamos frecuentes
//  [AT3-003 FIXED] Constructor usa custom errors en lugar de require strings
//
//  CHANGELOG v5.0 (AIONICA Audit Round 4 — KIMI + DeepSeek + Claude):
//  [V4-01  FIXED] _computeVested() — única fórmula para claim y views
//  [V4-02  FIXED] cancelOwnershipTransfer emite OwnershipTransferCancelled
//  [V4-03  INFO]  transferOwnership sobreescribe pendingOwner — diseño aceptado
//
//  CHANGELOG v5.1 (AIONICA Audit Round 5 — Claude + KIMI — INFO only):
//  [V5-01  FIXED] claimTeamVesting usa _computeVested() — elimina duplicación
//  [V5-02  FIXED] cancelOwnershipTransfer — noop silencioso si no hay pendiente
//  [V5-03  FIXED] _mintReward — guarda redundante eliminada (single source)
//
//  TOKENOMICS:
//  Supply total: 100,000,000 AIONICO (100M)
//  - 40% → Distribución a usuarios (recompensas por uso)
//  - 20% → Equipo AIONICA Lab (cliff 6m + vesting lineal 2 años)
//  - 20% → Liquidez inicial (DEX en World Chain)
//  - 10% → Fondo de seguro del protocolo
//  - 10% → Reserva para partnerships y ecosistema
// ============================================================

contract AionicoToken {

    // ── Metadata ERC20 ─────────────────────────────────────
    string public constant name     = "Aionico";
    string public constant symbol   = "AIONICO";
    uint8  public constant decimals = 18;

    // ── Supply ─────────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY     = 100_000_000 * 10**18;
    uint256 public constant REWARDS_POOL     =  40_000_000 * 10**18;
    uint256 public constant TEAM_ALLOCATION  =  20_000_000 * 10**18;
    uint256 public constant LIQUIDITY_POOL   =  20_000_000 * 10**18;
    uint256 public constant INSURANCE_FUND   =  10_000_000 * 10**18;
    uint256 public constant ECOSYSTEM_FUND   =  10_000_000 * 10**18;

    // ── Constantes de tiempo ───────────────────────────────

    /// @dev [AT-002 FIX] Cliff de 6 meses antes de que empiece el vesting
    uint256 public constant CLIFF_PERIOD         = 180 days;
    uint256 public constant VESTING_DURATION     = 730 days; // 2 años desde cliff

    /// @dev [AT3-001 FIX] Precision para reducir dust en vesting frecuente
    uint256 public constant VESTING_PRECISION    = 1e9; // escala intermedia segura

    // ── Constantes de recompensa ───────────────────────────
    uint256 public constant REWARD_ON_TIME_PAYMENT = 10  * 10**18;
    uint256 public constant REWARD_FULL_CYCLE       = 50  * 10**18;
    uint256 public constant REWARD_FULL_ROSCA       = 200 * 10**18;
    uint256 public constant REWARD_FIRST_CIRCLE     = 100 * 10**18;

    // ── Estado ─────────────────────────────────────────────
    address public owner;

    /// @dev [AT-001 FIX] Inmutable — seteado en constructor, nunca cambia
    address public immutable trustCircleContract;

    address public immutable teamVestingWallet;
    address public immutable insuranceFundWallet;
    address public immutable ecosystemFundWallet;

    uint256 public totalSupply;
    uint256 public rewardsDistributed;

    /// @dev Timestamp del deploy — base para cliff + vesting
    uint256 public immutable deployTime;

    uint256 public teamVestingClaimed;

    /// @dev [AT3-001 FIX] Tasa de vesting precomputada con precisión escalada
    /// = TEAM_ALLOCATION * VESTING_PRECISION / VESTING_DURATION (tokens*precision por segundo)
    uint256 public immutable vestingRateScaled;

    /// @dev [AT-003 FIX] Pausa de emergencia para rewards
    bool public rewardsPaused;

    /// @dev [AT2-003 FIX] Balance dedicado al rewards pool (separado del vesting)
    uint256 public rewardsBalance;

    /// @dev [V-04 FIX] Two-step ownership
    address public pendingOwner;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ── Eventos ERC20 ──────────────────────────────────────
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // ── Eventos custom ─────────────────────────────────────

    /// @dev [AT-005 INFO] Evento explícito de asignación inicial (no mint)
    event InitialAllocation(address indexed recipient, uint256 amount, string pool);
    event RewardMinted(address indexed recipient, uint256 amount, string reason);
    event TeamVestingClaimed(uint256 amount, uint256 timestamp);
    event RewardsPaused(address indexed by);
    event RewardsUnpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferInitiated(address indexed newOwner);
    event OwnershipTransferCancelled(address indexed cancelledFor); // [V4-02 FIX]

    // ── Errores ────────────────────────────────────────────
    error NotOwner();
    error NotTrustCircle();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();
    error CliffNotPassed();
    error NoVestedTokens();
    error RewardsPoolExhausted();
    error RewardsArePaused();
    error InvalidRecipient();
    error NotPendingOwner();
    error NotAuthorized();

    // ── Modificadores ──────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTrustCircle() {
        if (msg.sender != trustCircleContract) revert NotTrustCircle();
        _;
    }

    /// @dev [AT-003 FIX] Bloquea minteo si hay pausa de emergencia
    modifier whenRewardsNotPaused() {
        if (rewardsPaused) revert RewardsArePaused();
        _;
    }

    // ── Constructor ────────────────────────────────────────

    /// @dev [AT-001 FIX] trustCircleContract se recibe aquí — no hay setter
    constructor(
        address _trustCircleContract,
        address _teamWallet,
        address _insuranceFund,
        address _ecosystemFund,
        address _liquidityWallet
    ) {
        if (_trustCircleContract == address(0)) revert ZeroAddress(); // [AT3-003 FIX]
        if (_teamWallet          == address(0)) revert ZeroAddress();
        if (_insuranceFund       == address(0)) revert ZeroAddress();
        if (_ecosystemFund       == address(0)) revert ZeroAddress();
        if (_liquidityWallet     == address(0)) revert ZeroAddress();

        owner                = msg.sender;
        trustCircleContract  = _trustCircleContract; // inmutable desde aquí
        teamVestingWallet    = _teamWallet;
        insuranceFundWallet  = _insuranceFund;
        ecosystemFundWallet  = _ecosystemFund;
        deployTime           = block.timestamp;
        vestingRateScaled    = (TEAM_ALLOCATION * VESTING_PRECISION) / VESTING_DURATION; // [AT3-001]
        totalSupply          = TOTAL_SUPPLY;

        // Distribución inicial
        // 60M (rewards + team) quedan en el contrato
        // Team no puede retirarse hasta después del cliff de 6 meses
        _balances[address(this)]  = REWARDS_POOL + TEAM_ALLOCATION; // 60M
        rewardsBalance            = REWARDS_POOL; // [AT2-003 FIX] tracking separado
        _balances[_liquidityWallet] = LIQUIDITY_POOL;               // 20M
        _balances[_insuranceFund]   = INSURANCE_FUND;               // 10M
        _balances[_ecosystemFund]   = ECOSYSTEM_FUND;               // 10M

        // [AT-005 FIX] Eventos descriptivos de asignación — no Transfer desde 0
        emit InitialAllocation(address(this),   REWARDS_POOL,    "rewards_pool");
        emit InitialAllocation(address(this),   TEAM_ALLOCATION, "team_vesting");
        emit InitialAllocation(_liquidityWallet, LIQUIDITY_POOL, "liquidity");
        emit InitialAllocation(_insuranceFund,   INSURANCE_FUND, "insurance");
        emit InitialAllocation(_ecosystemFund,   ECOSYSTEM_FUND, "ecosystem");

        // Transfer event estándar para wallets externas (compatibilidad exploradores)
        emit Transfer(address(0), _liquidityWallet, LIQUIDITY_POOL);
        emit Transfer(address(0), _insuranceFund,   INSURANCE_FUND);
        emit Transfer(address(0), _ecosystemFund,   ECOSYSTEM_FUND);
        emit Transfer(address(0), address(this),    REWARDS_POOL + TEAM_ALLOCATION);
    }

    // ══════════════════════════════════════════════════════
    //  ERC20 ESTÁNDAR
    // ══════════════════════════════════════════════════════

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address _owner, address spender) external view returns (uint256) {
        return _allowances[_owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < amount) revert InsufficientAllowance();
        unchecked { _allowances[from][msg.sender] -= amount; }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0)) revert ZeroAddress(); // [AT-004 FIX]
        if (to   == address(0)) revert ZeroAddress();
        if (_balances[from] < amount) revert InsufficientBalance();
        unchecked {
            _balances[from] -= amount;
            _balances[to]   += amount;
        }
        emit Transfer(from, to, amount);
    }

    // ══════════════════════════════════════════════════════
    //  SISTEMA DE RECOMPENSAS
    //  Solo TrustCircle puede llamar — pausable por owner
    // ══════════════════════════════════════════════════════

    function mintPaymentReward(address recipient)
        external onlyTrustCircle whenRewardsNotPaused
    {
        _mintReward(recipient, REWARD_ON_TIME_PAYMENT, "on_time_payment");
    }

    function mintCycleReward(address recipient)
        external onlyTrustCircle whenRewardsNotPaused
    {
        _mintReward(recipient, REWARD_FULL_CYCLE, "full_cycle");
    }

    function mintRoscaReward(address recipient)
        external onlyTrustCircle whenRewardsNotPaused
    {
        _mintReward(recipient, REWARD_FULL_ROSCA, "rosca_completed");
    }

    function mintFirstCircleReward(address recipient)
        external onlyTrustCircle whenRewardsNotPaused
    {
        _mintReward(recipient, REWARD_FIRST_CIRCLE, "first_circle");
    }

    function _mintReward(address recipient, uint256 amount, string memory reason) internal {
        // [V-01 FIX] Bloquear recipient == address(this) — evita agotar contador sin mover tokens
        if (recipient == address(this)) revert InvalidRecipient();
        if (recipient == address(0))    revert ZeroAddress();
        // [V5-03 FIX] Una sola guarda — rewardsBalance es fuente de verdad
        // Invariante: rewardsBalance == REWARDS_POOL - rewardsDistributed
        if (rewardsBalance < amount) revert RewardsPoolExhausted();
        rewardsDistributed += amount;
        rewardsBalance     -= amount;
        _transfer(address(this), recipient, amount);
        emit RewardMinted(recipient, amount, reason);
    }

    // ══════════════════════════════════════════════════════
    //  VESTING DEL EQUIPO
    //  [AT-002 FIX] Cliff 6 meses + lineal 2 años desde cliff
    // ══════════════════════════════════════════════════════

    /// @dev [V4-01 FIX] Única fuente de verdad para el cálculo de vested
    /// Usada por claimTeamVesting, vestingClaimable y teamVestingStatus
    function _computeVested(uint256 elapsed) internal view returns (uint256) {
        if (elapsed >= VESTING_DURATION) return TEAM_ALLOCATION;
        return (vestingRateScaled * elapsed) / VESTING_PRECISION;
    }

    /// @notice Reclama tokens del equipo. Callable por owner O por teamVestingWallet.
    /// [V-03 FIX] teamVestingWallet puede reclamar su propio vesting si owner pierde acceso.
    function claimTeamVesting() external {
        if (msg.sender != owner && msg.sender != teamVestingWallet) revert NotAuthorized(); // [V3-04 FIX]
        uint256 cliffEnd = deployTime + CLIFF_PERIOD;

        // [AT-002 FIX] No se puede reclamar antes del cliff
        if (block.timestamp < cliffEnd) revert CliffNotPassed();

        // [V5-01 FIX] Usa _computeVested — única fuente de verdad, elimina duplicación
        uint256 elapsedSinceCliff = block.timestamp - cliffEnd;
        uint256 vested = _computeVested(elapsedSinceCliff);

        uint256 claimable = vested - teamVestingClaimed;
        if (claimable == 0) revert NoVestedTokens();

        teamVestingClaimed += claimable;
        _transfer(address(this), teamVestingWallet, claimable);
        emit TeamVestingClaimed(claimable, block.timestamp);
    }

    /// @notice Cuánto puede reclamar el equipo ahora
    function vestingClaimable() external view returns (uint256) {
        uint256 cliffEnd = deployTime + CLIFF_PERIOD;
        if (block.timestamp < cliffEnd) return 0;
        uint256 elapsed = block.timestamp - cliffEnd;
        return _computeVested(elapsed) - teamVestingClaimed; // [V4-01 FIX]
    }

    /// @notice Cuándo termina el cliff
    function cliffEndsAt() external view returns (uint256) {
        return deployTime + CLIFF_PERIOD;
    }

    // ══════════════════════════════════════════════════════
    //  EMERGENCIA — PAUSE DE REWARDS
    //  [AT-003 FIX]
    // ══════════════════════════════════════════════════════

    /// @notice Pausa la emisión de recompensas (ante bug o exploit)
    function pauseRewards() external onlyOwner {
        if (rewardsPaused) return; // [V3-03 FIX] no emitir evento fantasma
        rewardsPaused = true;
        emit RewardsPaused(msg.sender);
    }

    /// @notice Reactiva las recompensas
    function unpauseRewards() external onlyOwner {
        if (!rewardsPaused) return; // [V3-03 FIX]
        rewardsPaused = false;
        emit RewardsUnpaused(msg.sender);
    }

    // ══════════════════════════════════════════════════════
    //  ADMIN
    // ══════════════════════════════════════════════════════

    /// @notice Inicia transferencia de ownership — [V-04 FIX] two-step
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferInitiated(newOwner); // [V-02 FIX] evento
    }

    /// @notice Cancela transferencia de ownership pendiente — [V3-01 FIX]
    function cancelOwnershipTransfer() external onlyOwner {
        address cancelled = pendingOwner;
        if (cancelled == address(0)) return; // [V5-02 FIX] noop silencioso
        pendingOwner = address(0);
        emit OwnershipTransferCancelled(cancelled);
    }

    /// @notice El nuevo owner acepta la transferencia
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender); // [V-02 FIX] evento
        owner        = msg.sender;
        pendingOwner = address(0);
    }

    // ══════════════════════════════════════════════════════
    //  VISTAS DE ESTADO
    // ══════════════════════════════════════════════════════

    /// @notice [V3-02 FIX] rewardsBalance = única fuente de verdad
    function rewardsRemaining() external view returns (uint256) {
        return rewardsBalance;
    }

    function teamVestingStatus() external view returns (
        uint256 totalAllocated,
        uint256 claimed,
        uint256 claimableNow,
        uint256 cliffEnd,
        bool    cliffPassed
    ) {
        totalAllocated = TEAM_ALLOCATION;
        claimed        = teamVestingClaimed;
        cliffEnd       = deployTime + CLIFF_PERIOD;
        cliffPassed    = block.timestamp >= cliffEnd;
        if (cliffPassed) {
            uint256 elapsed = block.timestamp - cliffEnd;
            claimableNow = _computeVested(elapsed) - claimed; // [V4-01 FIX]
        } else {
            claimableNow = 0;
        }
    }
}
