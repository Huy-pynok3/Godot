# Story 2.1: MetaMask Bridge Utilities

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `metamask_bridge.gd` to build JS eval strings,
so that `Web3Manager` does not need to know JS syntax.

## Acceptance Criteria

1. `MetaMaskBridge.build_connect_request(callback)` returns a JS string that calls `ethereum.request({method: 'eth_requestAccounts'})` with the provided callback
2. `MetaMaskBridge.build_metadata_request(token_id, callback)` returns a JS string that calls BSC RPC `eth_call` for the given `token_id` with the provided callback
3. No file other than `autoloads/web3_manager.gd` imports or references `src/web3/metamask_bridge.gd`
4. Every method in `MetaMaskBridge` contains an `OS.has_feature("web")` guard — returns empty string `""` (not null) on non-web platforms
5. `metamask_bridge.gd` is a pure utility class (no `extends Node`, no autoload registration) — use `class_name MetaMaskBridge` with static methods only

## Tasks / Subtasks

- [x] Task 1: Create `src/web3/metamask_bridge.gd` (AC: #1, #2, #3, #4, #5)
  - [x] Declare `class_name MetaMaskBridge` — no `extends`, no autoload
  - [x] `static func build_connect_request(callback: JavaScriptObject) -> String`
    - [x] Guard: `if not OS.has_feature("web"): return ""`
    - [x] Build and return JS string calling `ethereum.request({method: 'eth_requestAccounts'})` with `callback`
  - [x] `static func build_metadata_request(token_id: int, callback: JavaScriptObject) -> String`
    - [x] Guard: `if not OS.has_feature("web"): return ""`
    - [x] Build and return JS string calling BSC RPC `eth_call` for token metadata with `callback`
  - [x] No bare `print()` calls — use `AppLogger` if any logging needed
  - [x] No `extends Node` — this is a pure static utility class

## Dev Notes

### What This Story Does

Creates `src/web3/metamask_bridge.gd` — a pure GDScript static utility class that encapsulates the construction of JavaScript `eval` strings for MetaMask and BSC RPC calls. Its sole consumer is `autoloads/web3_manager.gd`.

**Why it exists:** `Web3Manager` needs to call `JavaScriptBridge.eval(js_string)`. The raw JS string construction is verbose and error-prone. `MetaMaskBridge` isolates the JS string logic so `Web3Manager` never needs to know JS syntax — it just asks the bridge to build the string and passes in its callbacks.

**What it does NOT do:**
- It does NOT call `JavaScriptBridge` itself
- It does NOT create callbacks (that is `Web3Manager`'s job)
- It does NOT store state or member variables
- It is NOT registered as an Autoload in Project Settings

### Architecture Boundary: CRITICAL

From `game-architecture.md#Architectural-Boundaries` rule 3:
> `src/web3/` — only `autoloads/web3_manager.gd` may import from this folder; no other file uses `metamask_bridge.gd` directly

**This is a hard boundary.** If any file other than `web3_manager.gd` imports `metamask_bridge.gd`, it is an architectural violation. Do NOT create any other file that references it.

### Where the File Lives

Per `game-architecture.md#Project-Structure`:
```
src/
  web3/
    metamask_bridge.gd   ← THIS STORY (the directory already exists, currently empty)
```

`src/web3/` already exists from Epic 1 directory setup. There is no `.gitkeep` to remove.

### Class Design — Static Utility, No extends

```gdscript
# src/web3/metamask_bridge.gd
class_name MetaMaskBridge

static func build_connect_request(callback: JavaScriptObject) -> String:
    if not OS.has_feature("web"):
        return ""
    # JS string that calls ethereum.request and pipes result to callback
    return """
        ethereum.request({ method: 'eth_requestAccounts' })
            .then(function(accounts) { callback([{ address: accounts[0] }]); })
            .catch(function(err) { callback([{ error: err.message }]); });
    """.format({"callback": "..."})
```

**Why no `extends`:**
- This class has no lifecycle (no `_ready`, no `_process`, no scene tree presence)
- It is a namespace for two static string-builder functions
- Adding `extends Node` would make it instantiable and suggest it could be added to scene tree — incorrect
- GDScript allows `class_name` without `extends` for pure utility classes

**Why static methods:**
- No instance state needed — both functions are pure: input → output with no side effects
- `Web3Manager` calls them as `MetaMaskBridge.build_connect_request(...)` without instantiation

### The JavaScript Strings — BSC RPC Context

`NetworkConfig.BSC_RPC_URL` = `"https://data-seed-prebsc-1-s1.binance.org:8545"` (testnet) — this is the BSC RPC endpoint.

The JS string for `build_metadata_request` must perform a JSON-RPC `eth_call` to BSC to fetch NFT token metadata. The call structure:

```javascript
// eth_call to BSC RPC to get NFT stats
fetch('https://data-seed-prebsc-1-s1.binance.org:8545', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{
            to: '<CONTRACT_ADDRESS>',   // BombCrypto NFT contract
            data: '<encoded_call_data>' // encoded getHeroStats(token_id)
        }, 'latest'],
        id: token_id
    })
})
.then(r => r.json())
.then(function(result) { callback([result]); })
.catch(function(err) { callback([{ error: err.message }]); });
```

**Implementation note:** The actual contract address and ABI-encoded `data` field are project-specific. Since the backend is not yet built (per `project-context.md`), use `NetworkConfig.BSC_RPC_URL` for the endpoint. The `build_metadata_request` function should construct a valid `eth_call` JSON-RPC payload structure. The contract address can be a placeholder constant — define it in `NetworkConfig` or as a local const inside the method. Do NOT hardcode it as a magic string in the method body.

**Recommended approach:** Add a `const BSC_NFT_CONTRACT_ADDRESS` to `config/network.gd` with a placeholder value, then reference it via `NetworkConfig.BSC_NFT_CONTRACT_ADDRESS` inside `build_metadata_request`.

### `JavaScriptObject` Type — Godot 4.6 API

`JavaScriptBridge.create_callback(callable)` returns a `JavaScriptObject`. The returned object, when referenced in a JS `eval` string via the `JavaScriptBridge` JS scope, is callable from JavaScript.

**How the callback is referenced in JS strings:**
In Godot 4.6, `JavaScriptBridge.create_callback()` returns a `JavaScriptObject` that is directly callable from JavaScript. When the `JavaScriptObject` is passed to `JavaScriptBridge.eval()` via string interpolation, Godot bridges the call automatically. The approach is:

```gdscript
# In Web3Manager (caller — not this story's file):
var _wallet_callback: JavaScriptObject
_wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
var js := MetaMaskBridge.build_connect_request(_wallet_callback)
JavaScriptBridge.eval(js)
```

The `MetaMaskBridge` function receives the `JavaScriptObject` and references it in the JS string. Godot's JavaScript bridge allows using `JavaScriptObject` handles in `eval` contexts — the actual mechanism is that `Web3Manager` passes the callback object reference and the JS string incorporates it.

**Practical implementation pattern for the JS string:**

```gdscript
static func build_connect_request(callback: JavaScriptObject) -> String:
    if not OS.has_feature("web"):
        return ""
    # Godot's JavaScriptBridge allows calling GDScript callbacks from JS
    # The callback object must be referenced by a global JS variable
    # Web3Manager is responsible for binding it to window before eval
    return (
        "ethereum.request({ method: 'eth_requestAccounts' })"
        ".then(function(accounts) { gdCallback([{ address: accounts[0] }]); })"
        ".catch(function(err) { gdCallback([{ error: err.message }]); });"
    )
```

**Note:** The standard Godot 4 pattern for using `JavaScriptBridge.create_callback` in eval strings requires the callback to be bound to a `window` property before `eval` runs, OR using `JavaScriptBridge.get_interface("window")` to expose it. The exact binding mechanism should be handled in `Web3Manager.connect_wallet()` (story ST-2.2), not in this utility. For ST-2.1, `MetaMaskBridge` builds the JS string template — `Web3Manager` is responsible for binding the callback to `window.gdCallback` before calling `eval`.

### OS.has_feature("web") Guard Pattern

Every public method must include this guard as the first statement:

```gdscript
static func build_connect_request(callback: JavaScriptObject) -> String:
    if not OS.has_feature("web"):
        return ""
    # ... rest of implementation
```

**Why return `""` (empty string) not `null`:**
- Return type is `String` — GDScript 4 static typing requires a String return
- `Web3Manager` will receive `""` on non-web platforms and should no-op on empty string
- This is the "graceful no-op on PC" requirement from Epic 2's Definition of Done

**From `project-context.md#JavaScriptBridge-CRITICAL`:**
> `JavaScriptBridge` only works in HTML5/WebGL export — guard with `if OS.has_feature("web")` for any platform-conditional code

### No Logging in This File

`MetaMaskBridge` is a pure string builder — no state transitions, no errors can occur in the builder itself. Do NOT add `AppLogger` calls here. If the string construction fails (e.g., wrong format), the error will manifest when `Web3Manager` calls `JavaScriptBridge.eval()` and the JS throws — that error is handled in `Web3Manager`, not here.

### NetworkConfig Reference

`NetworkConfig.BSC_RPC_URL` = `"https://data-seed-prebsc-1-s1.binance.org:8545"` — already defined in `config/network.gd`. Use this constant; never hardcode the URL string inline.

If a contract address constant is needed, add it to `config/network.gd`:
```gdscript
# config/network.gd — ADD THIS:
const BSC_NFT_CONTRACT_ADDRESS := "0x0000000000000000000000000000000000000000"  # placeholder
```

### GDScript 4 Multiline String Syntax

For readable JS strings in GDScript 4, use triple-quoted strings:
```gdscript
var js := """
    ethereum.request({ method: 'eth_requestAccounts' })
        .then(function(accounts) { ... });
"""
```
Or concatenate with `+` for clarity. Both are valid GDScript 4 syntax. Prefer whichever is more readable for the JS content.

### Project Structure Notes

- File created: `src/web3/metamask_bridge.gd` (the `src/web3/` directory already exists from Epic 1 ST-1.1)
- No `.tscn` file — this is a pure GDScript class, no scene needed
- No Autoload registration in `project.godot` — `MetaMaskBridge` is accessed as a named class, not a singleton
- Godot will auto-generate `src/web3/metamask_bridge.gd.uid` on first editor open — include in File List

### Files NOT to Touch

- `autoloads/web3_manager.gd` — still a stub (signals only). ST-2.2 will implement `connect_wallet()`. This story only creates the bridge utility.
- `config/constants.gd` — no changes needed
- `config/balance.gd` — no changes needed
- Any `src/hero/`, `src/map/`, `src/bomb/` files — not in scope

### References

- Story requirements: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.1]
- Architecture boundary rule: [Source: _bmad-output/game-architecture.md#Architectural-Boundaries rule 3]
- Web3Manager pattern: [Source: _bmad-output/game-architecture.md#Novel-Pattern-2-Web3-JavaScriptBridge-Async-Call]
- JavaScriptBridge guard: [Source: _bmad-output/project-context.md#JavaScriptBridge-CRITICAL]
- Project structure: [Source: _bmad-output/game-architecture.md#Directory-Structure] — `src/web3/metamask_bridge.gd`
- BSC RPC URL: [Source: config/network.gd] — `NetworkConfig.BSC_RPC_URL`
- No magic numbers rule: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- Static config access: [Source: _bmad-output/project-context.md#Static-Config-Classes]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Created `src/web3/metamask_bridge.gd` as a pure static utility class (`class_name MetaMaskBridge`, no `extends`).
- `build_connect_request()`: guards with `OS.has_feature("web")`, returns JS string using `ethereum.request({method:'eth_requestAccounts'})` with result piped to `window.gdCallback`. Returns `""` on non-web.
- `build_metadata_request(token_id)`: guards with `OS.has_feature("web")`, builds `fetch()` JS string using `JSON.stringify()` for injection-safe payload construction. ABI-encodes `token_id` as 32-byte padded uint256 with `getHeroStats(uint256)` selector (`0x6352211e` — placeholder, update with real selector). Returns `""` on non-web.
- Added `const BSC_NFT_CONTRACT_ADDRESS` placeholder to `config/network.gd` so `metamask_bridge.gd` uses a named constant, not a magic string.
- No `print()` calls. No `AppLogger` calls (pure string builder — no state changes to log).
- Project runs clean: no new errors. Only pre-existing stub autoload warnings and known `main.tscn` UID warnings (unchanged).
- AC#3 (architectural boundary) verified by grep — no file outside `web3_manager.gd` references `metamask_bridge.gd`.
- ⚠️ Runtime test (actual MetaMask popup in browser) not possible during AI implementation — requires WebGL export and MetaMask browser extension. Developer must verify in browser build.
- ✅ Resolved review finding [HIGH]: Removed unused `_callback` parameter from both methods — was misleading (concurrent calls would collide on `window.gdCallback`); binding is Web3Manager's responsibility (ST-2.2).
- ✅ Resolved review finding [MED]: Replaced GDScript `%`-formatted JSON string embedded in `'`-delimited JS with `JSON.stringify()` calls inside the JS string — injection-safe, no quote escaping issues.
- ✅ Resolved review finding [MED]: `token_id` now ABI-encoded as 32-byte padded hex in the `data` field (`0x6352211e` selector + `%064x` token_id) so `eth_call` actually targets the correct token.
- ✅ Resolved review finding [MED]: File List note updated — `metamask_bridge.gd.uid` was already auto-generated (not pending editor open).

### File List

- `src/web3/metamask_bridge.gd` (new)
- `src/web3/metamask_bridge.gd.uid` (new — auto-generated by Godot)
- `config/network.gd` (modified — added `BSC_NFT_CONTRACT_ADDRESS` placeholder constant)

### Senior Developer Review (AI)

**Review Date:** 2026-02-21
**Outcome:** Changes Requested → Fixed

**Action Items:**
- [x] [HIGH] Remove unused `_callback` parameter — misleading API, concurrent calls collide on `window.gdCallback`
- [x] [MED] Fix JS injection: use `JSON.stringify()` instead of embedding GDScript `%`-formatted JSON inside `'`-delimited JS
- [x] [MED] Encode `token_id` in ABI `data` field — `"0x"` stub never actually fetches token stats
- [x] [MED] Fix File List note — uid file already generated, not pending editor open
- [ ] [LOW] `network.gd` scope expansion not captured in task checklist (documentation only — no code change needed)
- [ ] [LOW] `window.gdCallback` binding order contract not enforced — mitigated by doc-comments; enforcement deferred to ST-2.2

### Change Log

- 2026-02-21: Created `metamask_bridge.gd` with `build_connect_request` and `build_metadata_request` static methods. Added `BSC_NFT_CONTRACT_ADDRESS` to `network.gd`.
- 2026-02-21: Code review fixes — removed unused callback params, injection-safe JS via `JSON.stringify()`, ABI-encoded `token_id` in `data` field, updated File List note.
