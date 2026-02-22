class_name MetaMaskBridge
## Pure static utility class that builds JavaScript eval strings for Web3Manager.
## ARCHITECTURAL BOUNDARY: Only autoloads/web3_manager.gd may use this class.
## This class does NOT call JavaScriptBridge — it only builds JS strings.
##
## CALLBACK PATTERN: build_connect_request() calls window.gdCallback(args).
## build_metadata_request() calls window.gdMetaCallback(args).
## Web3Manager MUST bind its JavaScriptObject callbacks to the correct window properties BEFORE
## calling JavaScriptBridge.eval() with these strings. This is Web3Manager's responsibility.
## Concurrent calls use unique window property names to avoid callback collisions.


## Returns a JS string that requests MetaMask wallet accounts.
## The returned string calls window.gdCallback([{address}]) on success,
## or window.gdCallback([{error}]) on failure.
## Returns "" on non-web platforms (graceful no-op).
static func build_connect_request() -> String:
	if not OS.has_feature("web"):
		return ""
	return (
		"ethereum.request({ method: 'eth_requestAccounts' })"
		+ ".then(function(accounts) { window.gdCallback([{ address: accounts[0] }]); })"
		+ ".catch(function(err) { window.gdCallback([{ error: err.message }]); });"
	)


## Returns a JS string that fetches NFT hero metadata from BSC RPC for the given token_id.
## Uses eth_call with ABI-encoded getHeroStats(uint256) selector + token_id.
## The returned string calls window.gdMetaCallback([result]) on success,
## or window.gdMetaCallback([{error}]) on failure.
## Returns "" on non-web platforms (graceful no-op).
static func build_metadata_request(token_id: int) -> String:
	if not OS.has_feature("web"):
		return ""
	# ABI-encode: function selector for getHeroStats(uint256) = first 4 bytes of
	# keccak256("getHeroStats(uint256)") = 0x6352211e (placeholder — update with real selector)
	# followed by token_id left-padded to 32 bytes (64 hex chars).
	var token_id_hex := "%064x" % token_id
	var call_data := "0x6352211e" + token_id_hex
	return (
		"fetch(" + JSON.stringify(NetworkConfig.BSC_RPC_URL) + ", {"
		+ "method: 'POST',"
		+ "headers: {'Content-Type': 'application/json'},"
		+ "body: JSON.stringify({"
		+ "jsonrpc: '2.0', method: 'eth_call',"
		+ "params: [{ to: " + JSON.stringify(NetworkConfig.BSC_NFT_CONTRACT_ADDRESS)
		+ ", data: " + JSON.stringify(call_data) + " }, 'latest'],"
		+ "id: " + str(token_id)
		+ "})})"
		+ ".then(function(r){ return r.json(); })"
		+ ".then(function(result){ window.gdMetaCallback([result]); })"
		+ ".catch(function(err){ window.gdMetaCallback([{ error: err.message }]); });"
	)
