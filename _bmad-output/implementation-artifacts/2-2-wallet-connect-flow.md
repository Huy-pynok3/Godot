# Story 2.2: Wallet Connect Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to click "Connect Wallet" and have the MetaMask popup appear,
so that I can authenticate my BSC wallet and the game can identify my heroes.

## Acceptance Criteria

1. A "Connect Wallet" button exists in Lobby UI — in `autoloads/web3_manager.gd`, implement `connect_wallet()` that is called only from a button press (user gesture)
2. `Web3Manager.connect_wallet()` guards with `OS.has_feature("web")` — on non-web platforms it logs INFO and returns early without crashing
3. `_wallet_callback` is a **member variable** of `Web3Manager` (NOT a local variable inside `connect_wallet()`) — prevents GC before async JS fires
4. Before calling `JavaScriptBridge.eval()`, `Web3Manager` binds `_wallet_callback` to `window.gdCallback` via `JavaScriptBridge.get_interface("window")` so the JS string from `MetaMaskBridge.build_connect_request()` can call it
5. On MetaMask success: `GameState.wallet_address` is set to the returned address string, `wallet_connected(address)` signal is emitted
6. On MetaMask failure/rejection: `AppLogger.warn("Web3Manager", ...)` is called, `wallet_error(message)` signal is emitted
7. On PC (non-web): the Connect Wallet button is either disabled or shows a "Web3 not available on PC" label — button must NOT crash the game if clicked

## Tasks / Subtasks

- [x] Task 1: Implement `Web3Manager.connect_wallet()` in `autoloads/web3_manager.gd` (AC: #1, #2, #3, #4, #5, #6)
  - [x] Add `var _wallet_callback: JavaScriptObject` as a member variable (not local)
  - [x] Implement `func connect_wallet() -> void`
  - [x] Add `if not OS.has_feature("web"):` guard at top — log INFO and return
  - [x] Inside guard: create callback via `JavaScriptBridge.create_callback(_on_wallet_callback)` and store to `_wallet_callback`
  - [x] Bind callback to `window.gdCallback` via `JavaScriptBridge.get_interface("window").gdCallback = _wallet_callback`
  - [x] Call `JavaScriptBridge.eval(MetaMaskBridge.build_connect_request())`
  - [x] Implement `func _on_wallet_callback(args: Array) -> void`
    - [x] Read `args[0]` as Dictionary
    - [x] If result has `"error"` key: log WARN, emit `wallet_error(result["error"])`
    - [x] If result has `"address"` key: set `GameState.wallet_address = result["address"]`, emit `wallet_connected(result["address"])`

- [x] Task 2: Verify Lobby scene has a Connect Wallet button that calls `Web3Manager.connect_wallet()` (AC: #1, #7)
  - [x] Check `scenes/lobby/lobby.tscn` and `src/ui/lobby_ui.gd` exist (stubs from Epic 1)
  - [x] Add (or confirm) a Button node in lobby scene named `ConnectWalletButton`
  - [x] In `lobby_ui.gd`, connect `ConnectWalletButton.pressed` signal in `_ready()` to `_on_connect_wallet_pressed()`
  - [x] `_on_connect_wallet_pressed()` calls `Web3Manager.connect_wallet()`
  - [x] On non-web: disable button OR set its text to "Web3 not available" in `_ready()` (based on `OS.has_feature("web")`)
  - [x] Connect to `Web3Manager.wallet_connected` and `Web3Manager.wallet_error` signals in `_ready()`, disconnect in `_exit_tree()`

## Dev Notes

### What This Story Does

Implements the first interactive user flow: player clicks "Connect Wallet" → MetaMask popup appears → wallet address is received → `GameState.wallet_address` is set → `wallet_connected` signal fires. This is the entry point for the entire Web3 pipeline.

**What it modifies:**
- `autoloads/web3_manager.gd` — adds `connect_wallet()`, `_on_wallet_callback()`, `_wallet_callback` member var
- `src/ui/lobby_ui.gd` — adds button handling + signal connections
- Possibly `scenes/lobby/lobby.tscn` — may need ConnectWalletButton node added

**What it does NOT do:**
- Does NOT fetch NFT metadata (that's ST-2.4)
- Does NOT implement HeroData or NFTCache (ST-2.3, ST-2.5)
- Does NOT implement game phase transitions (Epic 8)
- `MetaMaskBridge` — must NOT be modified; already done in ST-2.1

### CRITICAL: window.gdCallback Binding — ST-2.1 Contract

`MetaMaskBridge.build_connect_request()` returns a JS string that references `window.gdCallback` (see ST-2.1 completion notes). **This means `Web3Manager` MUST set `window.gdCallback` to the callback object BEFORE calling `JavaScriptBridge.eval()`.**

The correct binding sequence:

```gdscript
func connect_wallet() -> void:
    if not OS.has_feature("web"):
        AppLogger.info("Web3Manager", "connect_wallet: no-op on non-web platform")
        return
    _wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
    # MUST bind to window.gdCallback BEFORE eval()
    var window := JavaScriptBridge.get_interface("window")
    window.gdCallback = _wallet_callback
    JavaScriptBridge.eval(MetaMaskBridge.build_connect_request())
```

**Why `JavaScriptBridge.get_interface("window")`:** This retrieves the browser's `window` object as a `JavaScriptObject`. Setting a property on it (`.gdCallback = ...`) is equivalent to `window.gdCallback = callback` in JavaScript. This is the standard Godot 4.x approach for making GDScript callable from JS eval strings.

**Why `window` variable is local:** `JavaScriptBridge.get_interface("window")` is a synchronous getter — it doesn't need to be stored as member. Only the callback needs member lifetime.

### CRITICAL: _wallet_callback MUST Be a Member Variable

From `game-architecture.md#Novel-Pattern-2` and `project-context.md#JavaScriptBridge-CRITICAL`:
> JS callback objects from `JavaScriptBridge.create_callback()` MUST be stored as member variables — local variables are GC'd before the async callback fires, causing silent failures with no error.

**Correct (member variable):**
```gdscript
# At class level in web3_manager.gd:
var _wallet_callback: JavaScriptObject

func connect_wallet() -> void:
    _wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
    ...
```

**Wrong (local variable — will silently fail):**
```gdscript
func connect_wallet() -> void:
    var callback := JavaScriptBridge.create_callback(_on_wallet_callback)  # ← GC'd immediately!
    ...
```

### CRITICAL: User Gesture Requirement

From `project-context.md#Web3-MetaMask-Gotchas`:
> MetaMask popups are blocked if not triggered by a direct user gesture (click) — never call wallet connect from `_ready()` or a timer

`connect_wallet()` MUST only ever be called in response to a button press. The `lobby_ui.gd` button handler is the only valid caller.

**Correct:**
```gdscript
# lobby_ui.gd
func _on_connect_wallet_pressed() -> void:
    Web3Manager.connect_wallet()
```

**Wrong — will cause MetaMask to silently block the popup:**
```gdscript
func _ready() -> void:
    Web3Manager.connect_wallet()  # ← MetaMask blocks this!
```

### Callback Handler: _on_wallet_callback

The `_on_wallet_callback` receives `args: Array` where `args[0]` is the JS object passed back from the MetaMask JS string. Based on `MetaMaskBridge.build_connect_request()` from ST-2.1, the JS string passes either `[{ address: accounts[0] }]` on success or `[{ error: err.message }]` on failure.

```gdscript
func _on_wallet_callback(args: Array) -> void:
    if args.is_empty():
        AppLogger.warn("Web3Manager", "Wallet callback received empty args")
        wallet_error.emit("Empty response from MetaMask")
        return
    var result: Dictionary = args[0]
    if result.has("error"):
        AppLogger.warn("Web3Manager", "Wallet connect failed", {"msg": result["error"]})
        wallet_error.emit(str(result["error"]))
        return
    if not result.has("address"):
        AppLogger.warn("Web3Manager", "Wallet callback missing address field", {"result": result})
        wallet_error.emit("Invalid response from MetaMask")
        return
    var address: String = str(result["address"])
    GameState.wallet_address = address
    AppLogger.info("Web3Manager", "Wallet connected", {"address": address})
    wallet_connected.emit(address)
```

**Note on `args[0]` type:** In Godot 4.6, `JavaScriptBridge.create_callback()` callbacks receive `args` as an `Array`. Each element is a `JavaScriptObject` wrapping the JS argument. When the JS passes a plain object `{ address: "0x..." }`, `args[0]` is a `JavaScriptObject` — but GDScript can use `.get()` and `.has()` syntax on it because `JavaScriptObject` supports dictionary-like access in Godot 4.x. Cast to `Dictionary` if needed: `var result := (args[0] as Dictionary)` or use `dict_from_var(args[0])` depending on Godot 4.6 API. Test carefully — if `args[0]` is a `JavaScriptObject` (not a `Dictionary`), use property access: `args[0]["address"]` or `args[0].address`.

> **Godot 4.6 note on JavaScriptObject:** `JavaScriptBridge.create_callback()` passes JS arguments as an `Array` where elements may be `Variant` (strings, numbers) or `JavaScriptObject` for complex objects. For plain JS objects, use `args[0].keys()` or `args[0]["property"]` — standard GDScript property access works on `JavaScriptObject`. Do NOT try to cast to `Dictionary` directly.

### PC Platform: No-Op and Button State

On non-web platforms (PC dev, PC export), `Web3Manager.connect_wallet()` must log and return without crashing. The Lobby UI must also be adapted:

```gdscript
# lobby_ui.gd
@onready var _connect_button: Button = $ConnectWalletButton

func _ready() -> void:
    if not OS.has_feature("web"):
        _connect_button.disabled = true
        _connect_button.text = "Web3 not available"
    else:
        _connect_button.pressed.connect(_on_connect_wallet_pressed)
        Web3Manager.wallet_connected.connect(_on_wallet_connected)
        Web3Manager.wallet_error.connect(_on_wallet_error)
```

Note: Only connect signals on web platform where they will be used. On PC the button is disabled so no signal handlers are needed.

### Signal Connections in LobbyUI

All signal connections in `lobby_ui.gd` must follow the project pattern:
- Connect in `_ready()`, disconnect in `_exit_tree()`
- Use typed callable form (not string-based)

```gdscript
func _ready() -> void:
    if OS.has_feature("web"):
        _connect_button.pressed.connect(_on_connect_wallet_pressed)
        Web3Manager.wallet_connected.connect(_on_wallet_connected)
        Web3Manager.wallet_error.connect(_on_wallet_error)
    else:
        _connect_button.disabled = true
        _connect_button.text = "Web3 not available"

func _exit_tree() -> void:
    if OS.has_feature("web"):
        if Web3Manager.wallet_connected.is_connected(_on_wallet_connected):
            Web3Manager.wallet_connected.disconnect(_on_wallet_connected)
        if Web3Manager.wallet_error.is_connected(_on_wallet_error):
            Web3Manager.wallet_error.disconnect(_on_wallet_error)
```

### Existing Stub State (Epic 1 Foundation)

`autoloads/web3_manager.gd` currently contains only signal declarations (stub from Epic 1, ST-1.4):

```gdscript
extends Node

signal wallet_connected(address: String)
signal wallet_error(message: String)
signal nft_metadata_received(token_id: int, stats: HeroData)
signal transaction_confirmed(tx_hash: String)
```

This story adds the first real implementation to this file. Do NOT remove or change the existing signal declarations — they are exactly correct per the architecture.

### Lobby Scene Status

Check whether `scenes/lobby/lobby.tscn` and `src/ui/lobby_ui.gd` exist (both were listed as stubs in Epic 1). If they exist as stubs, add the `ConnectWalletButton` node and hook it up. If `lobby_ui.gd` is completely empty, implement the minimal `_ready()` / `_exit_tree()` / button handler.

The button node in the scene should be named `ConnectWalletButton` and referenced via `@onready var _connect_button: Button = $ConnectWalletButton`.

### Architecture Compliance Checklist

- [ ] Only `web3_manager.gd` calls `JavaScriptBridge` — verify no other file does
- [ ] `_wallet_callback` is a class-level member variable (not local)
- [ ] `window.gdCallback` is bound before `JavaScriptBridge.eval()` is called
- [ ] `connect_wallet()` is only callable from user gesture (button press)
- [ ] Non-web guard present in `connect_wallet()`
- [ ] Signals use past-tense naming (`wallet_connected`, `wallet_error`) — already defined, don't rename
- [ ] Signal connections in `_ready()`, disconnections in `_exit_tree()`
- [ ] No `print()` calls — only `AppLogger.info/warn/error`
- [ ] No Godot 3 syntax (`yield`, `connect("sig", self, "_method")`, `onready var`)

### Concurrent Call Risk (Future, Not This Story)

ST-2.1 code review flagged that a single `window.gdCallback` means concurrent calls overwrite each other. **This story does NOT need to solve it** — `connect_wallet()` is a once-per-session operation triggered by a single button press. The concurrent-call problem is relevant for ST-2.4 (which fetches metadata for up to 15 heroes). The fix (unique `window` property names per call) is ST-2.4's responsibility.

### Files NOT to Touch

- `src/web3/metamask_bridge.gd` — must NOT be modified; already complete from ST-2.1
- `config/network.gd` — no changes needed
- `config/balance.gd` — no changes needed
- `config/constants.gd` — no changes needed
- Any `src/hero/`, `src/map/`, `src/bomb/` files — not in scope

### References

- Story requirements: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.2]
- Novel Pattern 2 (Web3 JavaScriptBridge Async Call): [Source: _bmad-output/game-architecture.md#Novel-Pattern-2]
- JavaScriptBridge CRITICAL rules: [Source: _bmad-output/project-context.md#JavaScriptBridge-CRITICAL]
- MetaMask popup user gesture requirement: [Source: _bmad-output/project-context.md#Web3-MetaMask-Gotchas]
- Architectural boundary (only Web3Manager calls JavaScriptBridge): [Source: _bmad-output/game-architecture.md#Architectural-Boundaries rule 3 and Consistency-Rules]
- Signal connect/disconnect pattern: [Source: _bmad-output/project-context.md#Godot-4.x-Engine-Rules Signals]
- No-op on PC: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.2 AC], [Source: _bmad-output/game-architecture.md#Definition-of-Done]
- MetaMaskBridge JS string and window.gdCallback contract: [Source: _bmad-output/implementation-artifacts/2-1-metamask-bridge-utilities.md#Completion-Notes]
- AppLogger usage: [Source: _bmad-output/project-context.md#AppLogger-Usage]
- `web3_manager.gd` stub state: [Source: autoloads/web3_manager.gd — signals only, no implementation]
- `GameState.wallet_address`: [Source: autoloads/game_state.gd — `var wallet_address: String = ""`]

### Previous Story Intelligence (ST-2.1 Learnings)

**From ST-2.1 completion notes and review fixes:**

1. **`window.gdCallback` is the binding name used** — `MetaMaskBridge.build_connect_request()` hardcodes `window.gdCallback(...)` in the returned JS string. `Web3Manager` MUST bind to this exact name before calling eval. Any mismatch = callback never fires, silent failure.

2. **`_wallet_callback` parameter was removed from `build_connect_request()`** — ST-2.1 review fixed this. `MetaMaskBridge.build_connect_request()` now takes **no parameters**. `Web3Manager` handles the binding itself. Do NOT pass anything to `build_connect_request()`.

3. **`JSON.stringify()` for injection safety** — already handled inside `MetaMaskBridge`. `Web3Manager` does not need to worry about JS injection in this story.

4. **Project ran clean on non-web (PC) platform** — the `OS.has_feature("web")` guards in `MetaMaskBridge` return `""`. If `Web3Manager.connect_wallet()` calls `JavaScriptBridge.eval("")`, that is a no-op but potentially logs a Godot warning. Safer to guard in `connect_wallet()` first before calling `MetaMaskBridge` at all.

5. **No `.uid` file needed for `web3_manager.gd`** — it already exists from Epic 1 and already has a `.uid` file. This story modifies the existing file, no new uid generation needed.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

Project ran clean — no new errors introduced. Pre-existing stub warnings unchanged.

### Completion Notes List

- Implemented `Web3Manager.connect_wallet()` with full `OS.has_feature("web")` guard, `_wallet_callback` as class-level member var, `window.gdCallback` binding via `JavaScriptBridge.get_interface("window")` before `eval()`.
- `_on_wallet_callback(args: Array)` uses `Variant` type annotation for `args[0]` (safe for both web JavaScriptObject and PC no-op path). Handles empty args, error field, and address field. Sets `GameState.wallet_address`, emits `wallet_connected` or `wallet_error`.
- Created `src/ui/lobby_ui.gd` as `extends Control` with `class_name LobbyUI`. Connects signals in `_ready()`, disconnects in `_exit_tree()`. On PC: button disabled with text "Web3 not available". On web: button triggers `connect_wallet()`, status label updated on success/error.
- Created `scenes/lobby/lobby.tscn` with Control root + CenterContainer + VBoxContainer + TitleLabel + ConnectWalletButton (Button) + StatusLabel (Label). Script bound to `lobby_ui.gd`.
- Project runs clean (PC build): `connect_wallet()` no-ops with INFO log; button shows "Web3 not available" as expected.
- ⚠️ Runtime MetaMask test (actual popup + BSC wallet) requires WebGL export + MetaMask browser extension — not testable in PC editor. Developer must verify in browser build.
- AC#3 (JavaScriptBridge only in web3_manager.gd + metamask_bridge.gd) verified by grep — no other files reference JavaScriptBridge.
- Used `var result: Variant = args[0]` rather than `JavaScriptObject` type hint because `JavaScriptObject` property access is valid on Variant — avoids any edge case with cross-platform type inference.
- ✅ Resolved review finding [HIGH]: Added `address == null` guard in `_on_wallet_callback` — if MetaMask returns no `"address"` field, logs WARN and emits `wallet_error("Invalid response from MetaMask")` instead of silently setting wallet address to `"<null>"`.
- ✅ Resolved review finding [HIGH]: Removed fake hand-crafted UID `uid://blobby_lobby01` from `lobby.tscn` — replaced with `[gd_scene format=3]` (no uid), Godot editor will assign a proper UID on next open. Also removed hardcoded script UID from ext_resource to avoid invalid UID warnings.
- ✅ Resolved review finding [MED]: Added clarifying comment on `result["error"] != null` null-check documenting JavaScriptObject semantics (absent keys return null, not undefined error).
- ✅ Resolved review finding [MED]: Added `_connect_button.pressed.disconnect(_on_connect_wallet_pressed)` to `_exit_tree()` — symmetric with connect in `_ready()`, prevents duplicate connections if scene reloaded.

### File List

- `autoloads/web3_manager.gd` (modified — added `connect_wallet()`, `_on_wallet_callback()`, `_wallet_callback` member var; review fix: added address null-guard)
- `src/ui/lobby_ui.gd` (new — LobbyUI Control script with button + signal handling; review fix: added button.pressed disconnect in _exit_tree)
- `scenes/lobby/lobby.tscn` (new — Lobby scene with ConnectWalletButton and StatusLabel; review fix: removed fake UID)
- `src/ui/lobby_ui.gd.uid` (new — auto-generated by Godot)

### Change Log

- 2026-02-21: Implemented ST-2.2 — `Web3Manager.connect_wallet()` with window.gdCallback binding, `_on_wallet_callback()` handler, `LobbyUI` Control with ConnectWalletButton, PC no-op support.
- 2026-02-21: Code review fixes — address null-guard in `_on_wallet_callback`, fake UID removed from `lobby.tscn`, button disconnect added to `_exit_tree()`, JavaScriptObject null semantics documented.

### Senior Developer Review (AI)

**Review Date:** 2026-02-21
**Outcome:** Changes Requested → Fixed

**Action Items:**
- [x] [HIGH] Missing `address` null-guard — `result["address"]` could set `GameState.wallet_address = "<null>"` on malformed response
- [x] [HIGH] `lobby.tscn` contained fake hand-crafted UID `uid://blobby_lobby01` — not a valid Godot UID format
- [x] [MED] `result["error"] != null` semantics undocumented — JavaScriptObject null-for-absent-key behavior not explained
- [x] [MED] `_connect_button.pressed` not disconnected in `_exit_tree()` — asymmetric with `_ready()` connect
- [ ] [LOW] `lobby.tscn` not referenced from main scene — expected (Epic 8), but not noted in completion notes
- [ ] [LOW] Lobby scene unreachable creates documentation gap for future developers
