#!/usr/bin/env python3
import os, sys, time, logging
from web3 import Web3
from eth_account import Account
from eth_account.messages import encode_defunct

RPC_URL              = os.environ["WORLD_CHAIN_RPC"]
VRF_ADDRESS          = os.environ["VRF_ADDRESS"]
TRUST_CIRCLE_ADDRESS = os.environ["TRUST_CIRCLE_ADDRESS"]
PRIVATE_KEY          = os.environ["VRF_PRIVATE_KEY"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
if not w3.is_connected():
    logging.error("No se pudo conectar a World Chain")
    sys.exit(1)

account = Account.from_key(PRIVATE_KEY)
logging.info(f"Nodo VRF activo: {account.address}")

VRF_ABI = [
    {"anonymous":False,"inputs":[{"indexed":True,"name":"requestId","type":"uint256"},{"indexed":True,"name":"requester","type":"address"}],"name":"RandomnessRequested","type":"event"},
    {"inputs":[{"name":"requestId","type":"uint256"}],"name":"isRequestFulfilled","outputs":[{"name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"requestId","type":"uint256"},{"name":"randomWord","type":"uint256"},{"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],"name":"fulfillRandomness","outputs":[],"stateMutability":"nonpayable","type":"function"}
]

TC_ABI = [
    {"inputs":[{"name":"circleId","type":"uint256"},{"name":"randomWord","type":"uint256"},{"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],"name":"fulfillCircleRandomness","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"name":"","type":"uint256"}],"name":"vrfRequestToCircle","outputs":[{"name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
]

vrf = w3.eth.contract(address=Web3.to_checksum_address(VRF_ADDRESS), abi=VRF_ABI)
tc  = w3.eth.contract(address=Web3.to_checksum_address(TRUST_CIRCLE_ADDRESS), abi=TC_ABI)

def get_from_block():
    try:
        with open("vrf/last_block.txt") as f:
            return int(f.read().strip()) + 1
    except:
        return w3.eth.block_number - 1000

def save_block(n):
    with open("vrf/last_block.txt", "w") as f:
        f.write(str(n))

def fulfill(request_id, random_word, circle_id):
    msg_hash = Web3.solidity_keccak(['uint256','uint256'], [request_id, random_word])
    signed   = account.sign_message(encode_defunct(primitive=msg_hash))
    nonce    = w3.eth.get_transaction_count(account.address, 'pending')
    gas      = tc.functions.fulfillCircleRandomness(
        circle_id, random_word, signed.v, signed.r, signed.s
    ).estimate_gas({'from': account.address})
    tx = tc.functions.fulfillCircleRandomness(
        circle_id, random_word, signed.v, signed.r, signed.s
    ).build_transaction({
        'from': account.address,
        'nonce': nonce,
        'gas': int(gas * 1.2),
        'gasPrice': w3.eth.gas_price
    })
    stx     = account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(stx.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise Exception(f"Tx fallida: {tx_hash.hex()}")
    logging.info(f"Request {request_id} cumplido: {tx_hash.hex()}")

from_block    = get_from_block()
current_block = w3.eth.block_number

event_sig = w3.keccak(text="RandomnessRequested(uint256,address)").hex()
logs = w3.eth.get_logs({
    "fromBlock": from_block,
    "toBlock":   "latest",
    "address":   vrf.address,
    "topics":    [event_sig]
})

if not logs:
    logging.info("Sin eventos nuevos")
    save_block(current_block)
    sys.exit(0)

for log in logs:
    rid = int(log['topics'][1].hex(), 16)
    if vrf.functions.isRequestFulfilled(rid).call():
        logging.info(f"Request {rid} ya cumplido, omitiendo")
        continue
    cid = tc.functions.vrfRequestToCircle(rid).call()
    if cid == 0:
        logging.warning(f"Request {rid} sin circleId, omitiendo")
        continue
    rw = int.from_bytes(os.urandom(32), 'big')
    for attempt in range(3):
        try:
            fulfill(rid, rw, cid)
            break
        except Exception as ex:
            logging.warning(f"Intento {attempt+1} fallido: {ex}")
            if attempt < 2:
                time.sleep(2 ** attempt)
            else:
                logging.error(f"Request {rid} fallido despues de 3 intentos")

save_block(max(int(l['blockNumber']) for l in logs))
