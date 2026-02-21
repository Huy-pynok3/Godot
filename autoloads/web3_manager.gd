extends Node

signal wallet_connected(address: String)
signal wallet_error(message: String)
signal nft_metadata_received(token_id: int, stats: HeroData)
signal transaction_confirmed(tx_hash: String)

## Member variable — MUST be class-level, not local.
## JavaScriptBridge.create_callback() returns a JavaScriptObject that is GC'd
## if stored as a local variable before the async JS callback fires.
var _wallet_callback: JavaScriptObject

## Member variable for NFT metadata fetch callback — same GC rule applies.
## Single member var means calls are NOT concurrent-safe: one fetch at a time.
var _metadata_callback: JavaScriptObject


## Request MetaMask wallet connection.
## MUST only be called from a user gesture (button press) — MetaMask blocks
## popups triggered from _ready() or timers.
## On non-web platforms: logs INFO and returns without crashing.
func connect_wallet() -> void:
	if not OS.has_feature("web"):
		AppLogger.info("Web3Manager", "connect_wallet: no-op on non-web platform")
		return
	_wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
	# Bind to window.gdCallback BEFORE eval — MetaMaskBridge JS strings call window.gdCallback(args)
	var window := JavaScriptBridge.get_interface("window")
	window.gdCallback = _wallet_callback
	JavaScriptBridge.eval(MetaMaskBridge.build_connect_request())


func _on_wallet_callback(args: Array) -> void:
	if args.is_empty():
		AppLogger.warn("Web3Manager", "Wallet callback received empty args")
		wallet_error.emit("Empty response from MetaMask")
		return
	# args[0] is a JavaScriptObject from the browser — access via [] operator.
	# On JavaScriptObject, missing keys return null (same as JS undefined coerced to null).
	# error check: null means key absent (success path); non-null means error string present.
	var result: Variant = args[0]
	if result["error"] != null:
		var msg: String = str(result["error"])
		AppLogger.warn("Web3Manager", "Wallet connect failed", {"msg": msg})
		wallet_error.emit(msg)
		return
	var address: Variant = result["address"]
	if address == null:
		AppLogger.warn("Web3Manager", "Wallet callback missing address field", {"result": str(result)})
		wallet_error.emit("Invalid response from MetaMask")
		return
	GameState.wallet_address = str(address)
	AppLogger.info("Web3Manager", "Wallet connected", {"address": str(address)})
	wallet_connected.emit(str(address))


## Fetch NFT hero stats from BSC RPC for a single token_id.
## Emits nft_metadata_received(token_id, stats) on success.
## Emits wallet_error(message) on failure.
## CALLERS: await 200ms between consecutive calls to avoid BSC RPC rate limits.
## This method is NOT concurrent-safe — one call at a time only.
func fetch_nft_metadata(token_id: int) -> void:
	if not OS.has_feature("web"):
		AppLogger.info("Web3Manager", "fetch_nft_metadata: no-op on non-web platform", {"token_id": token_id})
		return
	AppLogger.info("Web3Manager", "Fetching NFT metadata", {"token_id": token_id})
	_metadata_callback = JavaScriptBridge.create_callback(
		func(args: Array) -> void:
			_on_metadata_callback(token_id, args)
	)
	var window_obj := JavaScriptBridge.get_interface("window")
	window_obj.gdMetaCallback = _metadata_callback
	JavaScriptBridge.eval(MetaMaskBridge.build_metadata_request(token_id))


func _on_metadata_callback(token_id: int, args: Array) -> void:
	if args.is_empty():
		AppLogger.warn("Web3Manager", "NFT metadata callback empty args", {"token_id": token_id})
		wallet_error.emit("Empty response fetching hero %d" % token_id)
		return
	# args[0] is a JavaScriptObject — access via [] operator; absent keys return null.
	var result: Variant = args[0]
	if result["error"] != null:
		var msg := str(result["error"])
		AppLogger.warn("Web3Manager", "NFT metadata fetch failed", {"token_id": token_id, "msg": msg})
		wallet_error.emit(msg)
		return
	var rpc_result: Variant = result["result"]
	# Minimum valid ABI response is "0x" + 320 hex chars = 322 chars total.
	# A result shorter than this cannot contain 5 uint256 slots — treat as malformed.
	if rpc_result == null or str(rpc_result).length() < 322:
		AppLogger.warn("Web3Manager", "NFT metadata RPC result malformed", {"token_id": token_id})
		wallet_error.emit("Failed to fetch hero stats for token %d" % token_id)
		return
	var parsed: Variant = _parse_rpc_result(token_id, str(rpc_result))
	if parsed == null:
		AppLogger.warn("Web3Manager", "NFT metadata RPC result failed to decode", {"token_id": token_id})
		wallet_error.emit("Failed to decode hero stats for token %d" % token_id)
		return
	var stats := HeroData.from_dict(parsed)
	AppLogger.info("Web3Manager", "NFT metadata received", {"token_id": token_id, "power": stats.power, "speed": stats.speed})
	nft_metadata_received.emit(token_id, stats)


func _parse_rpc_result(token_id: int, result_hex: String) -> Variant:
	var hex := result_hex.substr(2) if result_hex.begins_with("0x") else result_hex
	if hex.length() < 320:
		# Caller already checked for >= 322 total length, so this path is a safety net only.
		AppLogger.warn("Web3Manager", "RPC hex too short after prefix strip", {"token_id": token_id, "len": hex.length()})
		return null
	# Slot order: power(0), speed(1), stamina(2), range(3), bomb_count(4)
	# PLACEHOLDER — confirm slot order against real BombCrypto NFT contract ABI
	return {
		"token_id":   token_id,
		"power":      hex.substr(0,   64).hex_to_int(),
		"speed":      hex.substr(64,  64).hex_to_int(),
		"stamina":    hex.substr(128, 64).hex_to_int(),
		"range":      hex.substr(192, 64).hex_to_int(),
		"bomb_count": hex.substr(256, 64).hex_to_int(),
	}
