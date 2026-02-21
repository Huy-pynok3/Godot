# Story 2.4: NFT Metadata Fetch

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a game,
I want to fetch NFT hero stats from the BSC RPC for each token ID,
so that the hero AI can use the correct on-chain stats.

## Acceptance Criteria

1. `Web3Manager.fetch_nft_metadata(token_id: int) -> void` — method exists and can be called per-hero
2. `_metadata_callback` is a **class-level member variable** of `Web3Manager` (not a local var) — prevents GC before async callback fires
3. On non-web platforms: `fetch_nft_metadata()` logs INFO and returns without crashing; no `JavaScriptBridge` calls made
4. Per-request flow: bind unique `window` callback → eval `MetaMaskBridge.build_metadata_request(token_id)` → wait for JS callback
5. On successful callback: parse BSC RPC response → create `HeroData` via `HeroData.from_dict()` → emit `nft_metadata_received(token_id, stats: HeroData)` signal
6. On fetch failure (error key present, empty args, or parse error): log WARN, emit `wallet_error(message)`, do NOT crash; idle loop continues
7. Stagger: minimum 200ms delay between consecutive `fetch_nft_metadata()` calls — use `await get_tree().create_timer(0.2).timeout` between calls when fetching a batch
8. `_metadata_callback` must be stored as a class-level member variable before `JavaScriptBridge.eval()` is called — same pattern as `_wallet_callback` in ST-2.2

## Tasks / Subtasks

- [x] Task 1: Add `_metadata_callback` member variable to `autoloads/web3_manager.gd` (AC: #2, #8)
  - [x] Add `var _metadata_callback: JavaScriptObject` as class-level member (below `_wallet_callback`)
  - [x] Add comment explaining GC risk (mirror the existing `_wallet_callback` comment style)

- [x] Task 2: Implement `fetch_nft_metadata(token_id: int) -> void` in `autoloads/web3_manager.gd` (AC: #1, #3, #4, #5, #6)
  - [x] Add platform guard: `if not OS.has_feature("web"):` → `AppLogger.info(...)` and `return`
  - [x] Create callback: `_metadata_callback = JavaScriptBridge.create_callback(_on_metadata_callback.bind(token_id))`
  - [x] Bind callback to unique window property: `var window := JavaScriptBridge.get_interface("window")` then `window.gdMetaCallback = _metadata_callback`
  - [x] Eval the JS string: `JavaScriptBridge.eval(MetaMaskBridge.build_metadata_request(token_id))`
  - [x] Add `AppLogger.info("Web3Manager", "fetch_nft_metadata called", {"token_id": token_id})`

- [x] Task 3: Implement `_on_metadata_callback(token_id: int, args: Array) -> void` in `autoloads/web3_manager.gd` (AC: #5, #6)
  - [x] Guard: `if args.is_empty():` → WARN + `wallet_error.emit(...)` + return
  - [x] Extract result: `var result: Variant = args[0]`
  - [x] Guard error key: `if result["error"] != null:` → WARN + `wallet_error.emit(str(result["error"]))` + return
  - [x] Parse hex response → Dictionary with 5 stats (see Dev Notes: BSC RPC Response Parsing)
  - [x] Create HeroData: `var stats := HeroData.from_dict(parsed_dict)`
  - [x] Emit signal: `nft_metadata_received.emit(token_id, stats)`
  - [x] Log success: `AppLogger.info("Web3Manager", "NFT metadata received", {"token_id": token_id})`

- [x] Task 4: Update `metamask_bridge.gd` callback binding to use `window.gdMetaCallback` (AC: #4)
  - [x] Verify that `build_metadata_request()` currently calls `window.gdCallback` — if so, it conflicts with `_wallet_callback`
  - [x] If conflict exists: update `build_metadata_request()` JS string to call `window.gdMetaCallback` instead of `window.gdCallback`
  - [x] Ensure `fetch_nft_metadata()` binds to `window.gdMetaCallback` (not `window.gdCallback`)

- [x] Task 5: Verify stagger behavior is documented for callers (AC: #7)
  - [x] Add a code comment to `fetch_nft_metadata()` stating: "Callers fetching multiple heroes MUST await 200ms between calls. See batch fetch pattern in Dev Notes."
  - [x] Note: ST-2.4 does NOT implement the batch orchestration loop — that belongs in ST-2.5 or the Lobby/TreasureHunt flow. This story only implements the single-token fetch method.

## Dev Notes

### What This Story Does

Implements `Web3Manager.fetch_nft_metadata(token_id: int)` — the single-token NFT metadata fetch path. When called, it:
1. Creates a JS callback object (stored as member var to prevent GC)
2. Binds it to `window.gdMetaCallback` on the browser window
3. Evaluates the JS string from `MetaMaskBridge.build_metadata_request(token_id)` (already implemented in ST-2.1)
4. When the JS callback fires, parses the BSC RPC hex response into a `HeroData` object
5. Emits `nft_metadata_received(token_id, stats)` signal

**This story modifies TWO files:**
- `autoloads/web3_manager.gd` — adds `_metadata_callback`, `fetch_nft_metadata()`, `_on_metadata_callback()`
- `src/web3/metamask_bridge.gd` — may need to update callback binding name from `gdCallback` to `gdMetaCallback` (see Critical: Callback Name Conflict)

**What it does NOT do:**
- Does NOT implement batch fetch (fetching all heroes at once) — that's caller's responsibility
- Does NOT write to NFT cache — that's ST-2.5 `NFTCache.store()`
- Does NOT implement the stagger loop — callers must `await` 200ms between calls
- Does NOT modify `nft_cache.gd` (still a stub, untouched)

### Existing Code State (After ST-2.1, 2.2, 2.3)

**`autoloads/web3_manager.gd`** — current state:
```gdscript
extends Node

signal wallet_connected(address: String)
signal wallet_error(message: String)
signal nft_metadata_received(token_id: int, stats: HeroData)
signal transaction_confirmed(tx_hash: String)

var _wallet_callback: JavaScriptObject

func connect_wallet() -> void:
    if not OS.has_feature("web"):
        AppLogger.info("Web3Manager", "connect_wallet: no-op on non-web platform")
        return
    _wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
    var window := JavaScriptBridge.get_interface("window")
    window.gdCallback = _wallet_callback
    JavaScriptBridge.eval(MetaMaskBridge.build_connect_request())

func _on_wallet_callback(args: Array) -> void:
    ... (full implementation)
```

The signal `nft_metadata_received(token_id: int, stats: HeroData)` is already declared — do NOT redeclare it.

**`src/web3/metamask_bridge.gd`** — `build_metadata_request(token_id: int)` already implemented with JS string that calls `window.gdCallback([result])`. **This is the callback name conflict** — see critical section below.

**`src/hero/hero_data.gd`** — `HeroData.from_dict(data: Dictionary)` is fully implemented. JSON key `"range"` maps to `blast_range` field. Keys expected: `token_id`, `power`, `speed`, `stamina`, `range`, `bomb_count`.

**`autoloads/nft_cache.gd`** — stub only: has `get_hero_stats(_token_id) -> HeroData: return null`. ST-2.4 does NOT call `NFTCache.store()` — that method doesn't exist yet (ST-2.5).

### CRITICAL: Callback Name Conflict

`build_connect_request()` (ST-2.1) and `build_metadata_request()` (ST-2.1) both currently produce JS that calls `window.gdCallback(...)`. If both callbacks are in flight simultaneously, they would clobber each other.

**Solution:** Use a separate `window` property name for the metadata callback:
- Wallet callback: `window.gdCallback` (established in ST-2.2, do NOT change)
- Metadata callback: `window.gdMetaCallback` (new for ST-2.4)

**Required change to `metamask_bridge.gd`:**
Update `build_metadata_request()` to call `window.gdMetaCallback` instead of `window.gdCallback`:
```gdscript
# Change this line in the JS string:
+ ".then(function(result){ window.gdCallback([result]); })"
+ ".catch(function(err){ window.gdCallback([{ error: err.message }]); });"
# TO:
+ ".then(function(result){ window.gdMetaCallback([result]); })"
+ ".catch(function(err){ window.gdMetaCallback([{ error: err.message }]); });"
```

And in `fetch_nft_metadata()` bind to `window.gdMetaCallback`:
```gdscript
var window_obj := JavaScriptBridge.get_interface("window")
window_obj.gdMetaCallback = _metadata_callback
```

### CRITICAL: BSC RPC Response Parsing

`MetaMaskBridge.build_metadata_request()` uses `fetch()` to call the BSC RPC `eth_call` endpoint. The JS callback receives the **raw JSON-RPC response object**, not the decoded values.

The raw BSC RPC response structure is:
```json
{ "jsonrpc": "2.0", "id": 42, "result": "0x0000...000005..." }
```

The `result` field is a hex-encoded ABI response. For a struct with 5 `uint256` fields, it is 5 × 32 bytes = 160 bytes = 320 hex chars (plus `0x` prefix).

**ABI decoding approach** — parse each 64-hex-char slot:
```gdscript
func _parse_rpc_result(token_id: int, result_hex: String) -> Dictionary:
    # result_hex is like "0x0000...0005 0000...0007 0000...0004 0000...0002 0000...0002"
    # Strip "0x" prefix
    var hex := result_hex.substr(2) if result_hex.begins_with("0x") else result_hex
    # Each uint256 is 64 hex chars (32 bytes)
    # Slot order matches contract ABI: power, speed, stamina, range, bomb_count
    # (Confirm slot order against actual BombCrypto NFT contract ABI)
    var power     := hex.substr(0,   64).hex_to_int()
    var speed     := hex.substr(64,  64).hex_to_int()
    var stamina   := hex.substr(128, 64).hex_to_int()
    var range_val := hex.substr(192, 64).hex_to_int()
    var bomb_cnt  := hex.substr(256, 64).hex_to_int()
    return {
        "token_id":   token_id,
        "power":      power,
        "speed":      speed,
        "stamina":    stamina,
        "range":      range_val,   # JSON key "range" → HeroData.blast_range field
        "bomb_count": bomb_cnt
    }
```

**IMPORTANT — Slot order**: The slot order above (`power, speed, stamina, range, bomb_count`) is an assumed order based on the game design. The actual ABI slot order depends on the real BombCrypto NFT contract's `getHeroStats()` function return signature. `NetworkConfig.BSC_NFT_CONTRACT_ADDRESS` is currently a placeholder (`0x000...`). The ABI selector `0x6352211e` in `metamask_bridge.gd` is also a placeholder. Implement parsing defensively — `HeroData.from_dict()` applies `clampi()` to all values so bad slot order results in clamped-but-safe values, not a crash.

**args[0] structure from JS callback**: `args[0]` is a `JavaScriptObject`. Access via `[]` operator — absent keys return `null`. The `result` field contains the hex string, `error` field contains the error message if any.

**Error handling** — if `result["result"]` is `null` or empty:
```gdscript
var rpc_result: Variant = result["result"]
if rpc_result == null or str(rpc_result).length() < 10:
    AppLogger.warn("Web3Manager", "NFT metadata RPC result empty or malformed", {"token_id": token_id})
    wallet_error.emit("Failed to fetch hero stats for token %d" % token_id)
    return
```

### CRITICAL: `_metadata_callback` Must Be Member Variable

Same rule as `_wallet_callback` from ST-2.2. The `JavaScriptObject` returned by `JavaScriptBridge.create_callback()` is garbage-collected if stored as a local variable before the async JS callback fires. This results in **silent failure with no error** — the callback simply never fires.

```gdscript
# WRONG — local var is GC'd before async callback fires:
func fetch_nft_metadata(token_id: int) -> void:
    var cb = JavaScriptBridge.create_callback(...)  # GC'd! Silent failure!
    JavaScriptBridge.eval(...)

# CORRECT — member var survives until callback fires:
var _metadata_callback: JavaScriptObject  # class-level

func fetch_nft_metadata(token_id: int) -> void:
    _metadata_callback = JavaScriptBridge.create_callback(...)
    JavaScriptBridge.eval(...)
```

**Implication for concurrent fetches**: Since `_metadata_callback` is a single member variable, calling `fetch_nft_metadata()` a second time before the first callback fires overwrites `_metadata_callback`. The first callback would be GC'd. This means calls must be staggered (AC #7) — NOT concurrent. One call at a time, await the `nft_metadata_received` signal or a timer before issuing the next call.

### CRITICAL: `.bind()` Pattern for token_id in Callback

The callback `_on_metadata_callback` needs to know which `token_id` fired. GDScript `Callable.bind()` passes extra arguments:

```gdscript
_metadata_callback = JavaScriptBridge.create_callback(
    _on_metadata_callback.bind(token_id)
)
```

This makes the callback signature:
```gdscript
func _on_metadata_callback(args: Array, token_id: int) -> void:
```

Wait — `JavaScriptBridge.create_callback()` passes the JS args as the **first** argument. With `.bind(token_id)`, Godot appends the bound args AFTER the callable's declared params. So:
- JS calls: `gdMetaCallback([result])`
- GDScript receives: `_on_metadata_callback(args: Array, token_id: int)` where `args = [[result]]` and `token_id` = the bound value

Note the double-wrapping: `args` is an Array where `args[0]` is the JS array `[result]`, so the actual result object is `args[0][0]` — **NOT `args[0]`** as in the wallet callback.

**Alternative simpler approach** — use a lambda to capture token_id:
```gdscript
_metadata_callback = JavaScriptBridge.create_callback(
    func(args: Array) -> void:
        _on_metadata_callback(token_id, args)
)
```
With this pattern, `args[0]` IS the result object directly (same as wallet callback). This is cleaner. Use this approach.

### Full Implementation Reference

```gdscript
# --- ADD to autoloads/web3_manager.gd ---

## Member variable — MUST be class-level, not local.
## JavaScriptBridge.create_callback() returns a JavaScriptObject that is GC'd
## if stored as a local variable before the async JS callback fires.
var _metadata_callback: JavaScriptObject


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
    var result: Variant = args[0]
    if result["error"] != null:
        var msg := str(result["error"])
        AppLogger.warn("Web3Manager", "NFT metadata fetch failed", {"token_id": token_id, "msg": msg})
        wallet_error.emit(msg)
        return
    var rpc_result: Variant = result["result"]
    if rpc_result == null or str(rpc_result).length() < 10:
        AppLogger.warn("Web3Manager", "NFT metadata RPC result malformed", {"token_id": token_id})
        wallet_error.emit("Failed to fetch hero stats for token %d" % token_id)
        return
    var parsed := _parse_rpc_result(token_id, str(rpc_result))
    var stats := HeroData.from_dict(parsed)
    AppLogger.info("Web3Manager", "NFT metadata received", {"token_id": token_id, "power": stats.power, "speed": stats.speed})
    nft_metadata_received.emit(token_id, stats)


func _parse_rpc_result(token_id: int, result_hex: String) -> Dictionary:
    var hex := result_hex.substr(2) if result_hex.begins_with("0x") else result_hex
    if hex.length() < 320:
        AppLogger.warn("Web3Manager", "RPC result too short to decode", {"token_id": token_id, "len": hex.length()})
        return {"token_id": token_id}   # from_dict will apply defaults + clampi
    # Slot order: power(0), speed(1), stamina(2), range(3), bomb_count(4)
    # PLACEHOLDER — confirm against real BombCrypto NFT contract ABI
    return {
        "token_id":   token_id,
        "power":      hex.substr(0,   64).hex_to_int(),
        "speed":      hex.substr(64,  64).hex_to_int(),
        "stamina":    hex.substr(128, 64).hex_to_int(),
        "range":      hex.substr(192, 64).hex_to_int(),
        "bomb_count": hex.substr(256, 64).hex_to_int(),
    }
```

### Smoke Test Approach

No test framework exists. Smoke test via `main.gd._ready()` (temporarily, debug build only):

```gdscript
# Temporary in main.gd — debug build only, remove after verification
if OS.is_debug_build():
    # Connect to the signal to observe output
    Web3Manager.nft_metadata_received.connect(func(tid, stats):
        AppLogger.info("Main", "ST-2.4 smoke: metadata received", {
            "token_id": tid, "power": stats.power, "speed": stats.speed
        })
    )
    Web3Manager.wallet_error.connect(func(msg):
        AppLogger.warn("Main", "ST-2.4 smoke: wallet_error", {"msg": msg})
    )
    # NOTE: fetch_nft_metadata is a no-op on non-web — smoke test will show INFO log only on PC
    Web3Manager.fetch_nft_metadata(42)
```

On PC build (non-web), this will log: `[INFO] [Web3Manager] fetch_nft_metadata: no-op on non-web platform` — this is correct and expected. Full smoke test requires a WebGL/HTML5 export with MetaMask and a valid BSC contract.

### Files NOT to Touch

- `autoloads/nft_cache.gd` — stub only; `store()` not yet implemented; ST-2.4 does NOT call it
- `autoloads/game_state.gd` — no changes needed
- `src/hero/hero_data.gd` — fully implemented in ST-2.3; do not modify
- `config/network.gd` — BSC_RPC_URL and BSC_NFT_CONTRACT_ADDRESS are placeholders; leave them as-is
- Any scene files, UI files — not in scope

### References

- Story requirements: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.4]
- Existing `build_metadata_request()` implementation: [Source: src/web3/metamask_bridge.gd]
- Existing `connect_wallet()` pattern to follow: [Source: autoloads/web3_manager.gd]
- `nft_metadata_received` signal already declared: [Source: autoloads/web3_manager.gd:5]
- `HeroData.from_dict()` maps JSON key "range" → `blast_range` field: [Source: src/hero/hero_data.gd]
- JavaScriptBridge callback must be member var: [Source: _bmad-output/project-context.md#JavaScriptBridge-CRITICAL]
- No `JavaScriptBridge` outside `Web3Manager`: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- AppLogger usage: [Source: _bmad-output/project-context.md#AppLogger-Usage]
- BSC RPC URL: [Source: config/network.gd:5]
- NFT contract address (placeholder): [Source: config/network.gd:6]
- Stagger rule (200ms): [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.4-AC]
- No threads in HTML5: [Source: _bmad-output/project-context.md#WebGL-HTML5-Constraints]

### Previous Story Intelligence (ST-2.1, 2.2, 2.3 Learnings)

1. **`var result: Variant = args[0]`** — Do NOT use type inference (`var result := args[0]`) or `JavaScriptObject` annotation. Use explicit `Variant` type. Godot cannot infer type from Array subscript access.

2. **`window.gdCallback` is taken by wallet callback** — Use a different property name for metadata: `window.gdMetaCallback`. Both callbacks fire into the same window object — name collisions cause silent overwrites.

3. **`_wallet_callback` pattern is established** — Mirror it exactly: declare member var, assign in method body before `eval()`, use lambda to capture `token_id` cleanly.

4. **`range` vs `blast_range`**: GDScript field is `blast_range` but the JSON key is `"range"`. The `_parse_rpc_result()` method must use `"range"` as the dictionary key (to match what `HeroData.from_dict()` reads from `data.get("range", 1)`).

5. **No test framework** — verified across ST-2.1, ST-2.2, ST-2.3. Smoke via temporary AppLogger calls in `main.gd._ready()`, then remove. On PC: only the no-op INFO log is verifiable; full test requires WebGL export.

6. **BSC_NFT_CONTRACT_ADDRESS is a placeholder** — `0x000...` currently. The `MetaMaskBridge.build_metadata_request()` ABI selector `0x6352211e` is also a placeholder. Implement the parsing correctly but document that contract-specific values must be updated before production use.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[INFO] [Web3Manager] fetch_nft_metadata: no-op on non-web platform — { "token_id": 42 }` ✅
- Smoke test: `[INFO] [Main] ST-2.4 smoke: fetch_nft_metadata(42) called — check log for no-op message on PC` ✅
- No parse errors. Pre-existing warnings only (stub signals, UID warning from main.tscn).

### Completion Notes List

1. **Callback name conflict resolved**: `build_metadata_request()` previously called `window.gdCallback` (same as wallet callback). Updated to `window.gdMetaCallback` in both `metamask_bridge.gd` JS string and `web3_manager.gd` binding. Wallet callback at `window.gdCallback` unchanged.

2. **Lambda capture pattern used**: `_on_metadata_callback` receives `token_id` via lambda closure — `func(args: Array) -> _on_metadata_callback(token_id, args)` — avoids `.bind()` double-wrapping. `args[0]` is the direct `JavaScriptObject` result.

3. **`_metadata_callback` is class-level member**: mirrors `_wallet_callback` pattern from ST-2.2. Comments document the single-var limitation (not concurrent-safe).

4. **`_parse_rpc_result()` slot order is PLACEHOLDER**: assumes `power, speed, stamina, range, bomb_count` order. Must be confirmed against real BombCrypto NFT contract ABI before production use.

5. **`range` key used in parsed dict**: `_parse_rpc_result()` outputs `"range"` key (not `"blast_range"`) — matches what `HeroData.from_dict()` reads from `data.get("range", 1)`. Established in ST-2.3.

6. **Code-review fixes applied (H1, M1)**:
   - H1: `_parse_rpc_result()` return type changed from `Dictionary` to `Variant`. Returns `null` on decode failure instead of a minimal dict `{"token_id": token_id}` that would silently produce corrupt all-default `HeroData`. Caller now checks for `null` and emits `wallet_error` instead of proceeding.
   - M1: RPC result length threshold raised from magic `< 10` to documented `< 322` (`"0x"` prefix + 320 hex chars = minimum valid 5-slot ABI response). Both pre-strip check in `_on_metadata_callback` and post-strip check in `_parse_rpc_result` use correct thresholds.
   - Type-inference fix: `var parsed := _parse_rpc_result(...)` caused "Warning treated as error" (Godot 4.6 cannot infer type from `Variant`-returning call with `:=`). Changed to `var parsed: Variant = _parse_rpc_result(...)`.

7. **AC verification**:
   - AC1: `fetch_nft_metadata(token_id: int) -> void` exists ✅
   - AC2: `_metadata_callback: JavaScriptObject` is class-level ✅
   - AC3: Platform guard → INFO log + return on non-web ✅
   - AC4: Uses `window.gdMetaCallback` (unique from wallet `window.gdCallback`) ✅
   - AC5: Parses → `HeroData.from_dict()` → emits `nft_metadata_received` ✅
   - AC6: All error paths → WARN log + `wallet_error.emit()` + return ✅ (including null from `_parse_rpc_result`)
   - AC7: Stagger documented in method comment; implementation is single-fetch ✅
   - AC8: `_metadata_callback` assigned before `eval()` call ✅

### File List

- `autoloads/web3_manager.gd` — modified (added `_metadata_callback`, `fetch_nft_metadata()`, `_on_metadata_callback()`, `_parse_rpc_result()`)
- `src/web3/metamask_bridge.gd` — modified (updated JS string + docstrings to use `window.gdMetaCallback` instead of `window.gdCallback`)
