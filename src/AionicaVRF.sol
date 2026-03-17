// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// ============================================================
//  AionicaVRF.sol - Verificador de Entropia Soberana
//  AIONICA Security Lab - v2.0
//  World Chain (EVM compatible)
// ============================================================
//
//  CAMBIOS v2.0 respecto al diseno original de Gemini:
//  [VRF-01] aionicaMasterNode cambiado de immutable a rotable
//  [VRF-02] Rotacion two-step + timelock de 48 horas
//  [VRF-03] pragma actualizado a ^0.8.29
//  [VRF-04] Custom errors en lugar de require strings
//
//  ARQUITECTURA:
//  El nodo soberano (GitHub Actions) escucha eventos
//  RandomnessRequested, genera os.urandom(32), firma con
//  la clave privada del repo secreto, y llama
//  fulfillRandomness on-chain. TrustCircle verifica la
//  firma via este contrato antes de activar el circulo.
// ============================================================

contract AionicaVRF {

    // ── Constantes ────────────────────────────────────────
    uint256 public constant TIMELOCK = 2 days;

    // ── Estado ────────────────────────────────────────────
    address public owner;
    address public masterNode;
    address public pendingMasterNode;
    uint256 public masterNodeTransferTime;
    uint256 private requestNonce;

    struct Request {
        address requester;
        bool fulfilled;
    }
    mapping(uint256 => Request) public requests;

    // ── Eventos ───────────────────────────────────────────
    event RandomnessRequested(uint256 indexed requestId, address indexed requester);
    event RandomnessDelivered(uint256 indexed requestId, uint256 randomWord);
    event MasterNodeTransferInitiated(address indexed current, address indexed pending, uint256 deadline);
    event MasterNodeTransferred(address indexed oldNode, address indexed newNode);
    event MasterNodeTransferCancelled(address indexed cancelledFor);

    // ── Errores ───────────────────────────────────────────
    error NotOwner();
    error UnauthorizedNode();
    error RequestAlreadyFulfilledOrInvalid();
    error InvalidSignature();
    error NoPendingTransfer();
    error TransferNotReady();
    error TransferInProgress();
    error ZeroAddress();

    // ── Modificadores ─────────────────────────────────────
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ── Constructor ───────────────────────────────────────
    constructor(address _initialMasterNode) {
        if (_initialMasterNode == address(0)) revert ZeroAddress();
        owner = msg.sender;
        masterNode = _initialMasterNode;
        requestNonce = 1;
    }

    // ── Rotacion de clave two-step + timelock ─────────────

    /// @notice Inicia la transferencia del nodo maestro
    /// @dev El nuevo nodo debe aceptar despues del timelock de 48h
    function initiateMasterNodeTransfer(address _newMaster) external onlyOwner {
        if (_newMaster == address(0)) revert ZeroAddress();
        if (pendingMasterNode != address(0)) revert TransferInProgress();
        pendingMasterNode = _newMaster;
        masterNodeTransferTime = block.timestamp + TIMELOCK;
        emit MasterNodeTransferInitiated(masterNode, _newMaster, masterNodeTransferTime);
    }

    /// @notice El nuevo nodo acepta la transferencia despues del timelock
    function acceptMasterNode() external {
        if (pendingMasterNode == address(0)) revert NoPendingTransfer();
        if (block.timestamp < masterNodeTransferTime) revert TransferNotReady();
        if (msg.sender != pendingMasterNode) revert UnauthorizedNode();
        address oldNode = masterNode;
        masterNode = pendingMasterNode;
        delete pendingMasterNode;
        delete masterNodeTransferTime;
        emit MasterNodeTransferred(oldNode, masterNode);
    }

    /// @notice Cancela una transferencia pendiente
    function cancelMasterNodeTransfer() external onlyOwner {
        if (pendingMasterNode == address(0)) revert NoPendingTransfer();
        address cancelled = pendingMasterNode;
        delete pendingMasterNode;
        delete masterNodeTransferTime;
        emit MasterNodeTransferCancelled(cancelled);
    }

    // ── Funciones VRF ─────────────────────────────────────

    /// @notice Solicita un numero aleatorio soberano
    /// @return requestId Identificador unico de la solicitud
    function requestRandomness() external returns (uint256) {
        uint256 requestId = requestNonce++;
        requests[requestId] = Request(msg.sender, false);
        emit RandomnessRequested(requestId, msg.sender);
        return requestId;
    }

    /// @notice El nodo maestro entrega el numero aleatorio firmado
    /// @param requestId ID de la solicitud original
    /// @param randomWord Numero generado por os.urandom(32) del nodo
    /// @param v Parametro de recuperacion ECDSA
    /// @param r Mitad de la firma ECDSA
    /// @param s Mitad de la firma ECDSA
    function fulfillRandomness(
        uint256 requestId,
        uint256 randomWord,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        // [B7-C1 FIX] Eliminado — autenticacion via ECDSA en ecrecover es suficiente

        Request storage req = requests[requestId];
        if (req.requester == address(0) || req.fulfilled) revert RequestAlreadyFulfilledOrInvalid();

        // Verificar firma ECDSA
        bytes32 messageHash = keccak256(abi.encodePacked(requestId, randomWord));
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        address recovered = ecrecover(ethSignedMessageHash, v, r, s);
        if (recovered != masterNode) revert InvalidSignature();

        req.fulfilled = true;
        emit RandomnessDelivered(requestId, randomWord);
    }

    /// @notice Consulta si una solicitud fue cumplida
    function isRequestFulfilled(uint256 requestId) external view returns (bool) {
        return requests[requestId].fulfilled;
    }
}
