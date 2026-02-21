# Story 3.4: Incoming Message Parser & Signal Emitter

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a HeroAI/HUD,
I want to receive server confirmations via typed GDScript signals,
so that game logic does not need to parse raw JSON — it only connects to well-typed signals.

## Acceptance Criteria

1. `ServerAPI` reads all available WebSocket packets every frame inside `_process()` — after `poll()` is called
2. Each packet is decoded from `PackedByteArray` → `String` → parsed with `JSON.parse_string()`
3. On JSON parse failure: log WARN with raw text, skip packet — no crash
4. `"hero_move_confirmed"` message → emit `hero_move_confirmed(hero_id: int, new_position: Vector2i)`
5. `"hero_move_rejected"` message → emit `hero_move_rejected(hero_id: int)`
6. `"bomb_validated"` message → emit `bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)`
7. `"stamina_updated"` message → emit `stamina_updated(hero_id: int, new_value: float)`
8. `"reward_received"` message → emit `reward_received(hero_id: int, bcoin_amount: float)`
9. Unrecognized `type` value: log WARN with type string, skip — no crash
10. Missing required fields in a known message: log WARN, skip that packet — no crash

## Tasks / Subtasks

- [x] Task 1: Add packet reading loop to `_process()` STATE_OPEN branch (AC: #1, #2, #3)
  - [x] After `server_connected.emit()` guard block, add `while _websocket.get_available_packet_count() > 0:` loop
  - [x] Inside loop: `var raw := _websocket.get_packet().get_string_from_utf8()`
  - [x] Parse: `var data = JSON.parse_string(raw)`
  - [x] Guard: `if data == null or not data is Dictionary: AppLogger.warn("ServerAPI", "Malformed packet", {"raw": raw}); continue`

- [x] Task 2: Implement `_handle_server_message(data: Dictionary)` private method (AC: #4–#10)
  - [x] Extract type: `var type: String = data.get("type", "")`
  - [x] `match type:` block dispatching to per-type handlers
  - [x] `"hero_move_confirmed"` branch: guard required fields, emit `hero_move_confirmed(data["hero_id"], Vector2i(data["x"], data["y"]))`
  - [x] `"hero_move_rejected"` branch: guard required fields, emit `hero_move_rejected(data["hero_id"])`
  - [x] `"bomb_validated"` branch: guard required fields, emit `bomb_validated(data["hero_id"], Vector2i(data["x"], data["y"]), data["chest_destroyed"])`
  - [x] `"stamina_updated"` branch: guard required fields, emit `stamina_updated(data["hero_id"], float(data["new_value"]))`
  - [x] `"reward_received"` branch: guard required fields, emit `reward_received(data["hero_id"], float(data["bcoin_amount"]))`
  - [x] `_:` default branch: `AppLogger.warn("ServerAPI", "Unknown message type", {"type": type})`

- [x] Task 3: Smoke test (temporary, debug only) (AC: all)
  - [x] Verify no parse errors and the packet loop compiles cleanly
  - [x] Test malformed JSON path: not testable without server; confirm no crash on startup
  - [ ] Remove smoke test after verification

## Dev Notes

### What This Story Does

Adds the **incoming half** of the game's WebSocket protocol to `ServerAPI`. The outgoing half (ST-3.3) is already done. This story closes the round-trip:

```
HeroAI → send_move_intent() → SERVER → hero_move_confirmed signal → HeroAI._on_move_confirmed()
```

All five typed signals are already **declared** in `server_api.gd` (lines 3-9) — they were stubbed in ST-1.4. This story makes them **emit** with real data.

This story modifies **ONE file:**
- `autoloads/server_api.gd` — adds packet reading loop + `_handle_server_message()` dispatch

### Existing Code State (after ST-3.1 + ST-3.2 + ST-3.3 + code reviews)

```gdscript
extends Node

signal server_connected()
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()

var _websocket: WebSocketPeer       # private; never expose
var _connected: bool = false        # true only when STATE_OPEN
var _reconnecting: bool = false     # true while reconnect coroutine runs

func connect_to_server() -> void: ...  # guards _reconnecting + STATE
func _connect_websocket() -> bool: ... # creates WebSocketPeer + connect_to_url()
func _attempt_reconnect() -> void: ... # fire-and-forget coroutine, 3 retries, exp backoff
func send_move_intent(hero_id: int, target_cell: Vector2i) -> void: ...
func send_bomb_intent(hero_id: int, cell: Vector2i) -> void: ...

func _process(_delta: float) -> void:
    if _websocket == null:
        return
    _websocket.poll()
    match _websocket.get_ready_state():
        WebSocketPeer.STATE_OPEN:
            if not _connected:
                _connected = true
                AppLogger.info("ServerAPI", "Connected to server")
                server_connected.emit()
            # ← ST-3.4 adds packet reading HERE (inside STATE_OPEN branch, after the guard)
        WebSocketPeer.STATE_CLOSED:
            if _connected:
                _connected = false
                AppLogger.warn("ServerAPI", "WebSocket connection closed")
                _attempt_reconnect()
            elif not _reconnecting:
                AppLogger.warn("ServerAPI", "WebSocket connection attempt failed")
            _websocket = null
        WebSocketPeer.STATE_CONNECTING, WebSocketPeer.STATE_CLOSING:
            pass
```

### CRITICAL: Godot 4 WebSocketPeer Receive API

```gdscript
# Reading all available packets in one frame:
while _websocket.get_available_packet_count() > 0:
    var raw := _websocket.get_packet().get_string_from_utf8()
    var data = JSON.parse_string(raw)
    if data == null or not data is Dictionary:
        AppLogger.warn("ServerAPI", "Malformed WebSocket packet", {"raw": raw})
        continue
    _handle_server_message(data)
```

**Key API facts:**
- `WebSocketPeer.get_available_packet_count() -> int` — returns number of buffered packets ready to read
- `WebSocketPeer.get_packet() -> PackedByteArray` — dequeues one packet; call only if count > 0
- `PackedByteArray.get_string_from_utf8() -> String` — decodes bytes to UTF-8 string
- `JSON.parse_string(text: String) -> Variant` — returns `null` on failure, `Dictionary` on valid JSON object
- **DO NOT use** `JSON.new().parse()` — that is the Godot 3 / older Godot 4 pattern; `JSON.parse_string()` is the clean static API in Godot 4.x
- **DO NOT use** `get_packet()` outside of `get_available_packet_count() > 0` guard — may return empty array if called when no packets are buffered

### CRITICAL: Where to Insert the Packet Loop

The packet reading loop goes **inside the `STATE_OPEN:` branch**, **after** the `_connected` guard:

```gdscript
WebSocketPeer.STATE_OPEN:
    if not _connected:
        _connected = true
        AppLogger.info("ServerAPI", "Connected to server")
        server_connected.emit()
    # Packet reading loop — always runs when connected
    while _websocket.get_available_packet_count() > 0:
        var raw := _websocket.get_packet().get_string_from_utf8()
        var data = JSON.parse_string(raw)
        if data == null or not data is Dictionary:
            AppLogger.warn("ServerAPI", "Malformed WebSocket packet", {"raw": raw})
            continue
        _handle_server_message(data)
```

**Why inside STATE_OPEN only:** Packets only arrive when the connection is established. Reading packets in STATE_CLOSED or CONNECTING is meaningless and could cause errors.

### CRITICAL: Message Schema — Expected Server Messages

From epic-3 AC:

| `type` | Required fields | Signal emitted |
|---|---|---|
| `"hero_move_confirmed"` | `hero_id`, `x`, `y` | `hero_move_confirmed(hero_id, Vector2i(x, y))` |
| `"hero_move_rejected"` | `hero_id` | `hero_move_rejected(hero_id)` |
| `"bomb_validated"` | `hero_id`, `x`, `y`, `chest_destroyed` | `bomb_validated(hero_id, Vector2i(x, y), chest_destroyed)` |
| `"stamina_updated"` | `hero_id`, `new_value` | `stamina_updated(hero_id, float(new_value))` |
| `"reward_received"` | `hero_id`, `bcoin_amount` | `reward_received(hero_id, float(bcoin_amount))` |

Position uses flat `x`/`y` keys (same as outgoing messages) — consistent with ST-3.3 protocol.

### CRITICAL: _handle_server_message() Implementation Pattern

```gdscript
func _handle_server_message(data: Dictionary) -> void:
    var type: String = data.get("type", "")
    match type:
        "hero_move_confirmed":
            if not data.has_all(["hero_id", "x", "y"]):
                AppLogger.warn("ServerAPI", "hero_move_confirmed missing fields", {"data": data})
                return
            hero_move_confirmed.emit(data["hero_id"], Vector2i(data["x"], data["y"]))
        "hero_move_rejected":
            if not data.has("hero_id"):
                AppLogger.warn("ServerAPI", "hero_move_rejected missing hero_id", {"data": data})
                return
            hero_move_rejected.emit(data["hero_id"])
        "bomb_validated":
            if not data.has_all(["hero_id", "x", "y", "chest_destroyed"]):
                AppLogger.warn("ServerAPI", "bomb_validated missing fields", {"data": data})
                return
            bomb_validated.emit(data["hero_id"], Vector2i(data["x"], data["y"]), data["chest_destroyed"])
        "stamina_updated":
            if not data.has_all(["hero_id", "new_value"]):
                AppLogger.warn("ServerAPI", "stamina_updated missing fields", {"data": data})
                return
            stamina_updated.emit(data["hero_id"], float(data["new_value"]))
        "reward_received":
            if not data.has_all(["hero_id", "bcoin_amount"]):
                AppLogger.warn("ServerAPI", "reward_received missing fields", {"data": data})
                return
            reward_received.emit(data["hero_id"], float(data["bcoin_amount"]))
        _:
            AppLogger.warn("ServerAPI", "Unknown server message type", {"type": type})
```

**Notes:**
- `Dictionary.has_all(keys: Array) -> bool` — Godot 4 API; checks multiple keys at once
- `data["key"]` is safe AFTER `has_all()` guard — no KeyError possible
- `float(data["new_value"])` — explicit cast because JSON may parse numbers as `int` if they are whole numbers; `float()` is defensive
- `data.get("type", "")` — returns empty string on missing key, which falls to `_:` default branch safely

### CRITICAL: No await, No Blocking in _process()

The packet reading loop is a tight synchronous `while` loop — **no `await` anywhere inside it**. This is correct for Godot 4 WebSocket packet handling. Each `get_packet()` call is O(1) dequeue from an internal buffer already filled by `poll()`.

### CRITICAL: Stub Signals Already Declared

These signals are **already declared** in `server_api.gd` (lines 3-9) from ST-1.4. Do NOT re-declare them — just emit them:

```gdscript
# Already declared — DO NOT add again:
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
```

The pre-existing WARNING messages ("signal X declared but never explicitly used") will disappear once the signals are emitted — this confirms implementation is correct.

### Smoke Test Approach

No real server available — smoke test verifies:
1. **No parse errors**: Project runs without GDScript errors ✅
2. **No crash on startup**: Packet loop code compiles but never fires without a connection ✅
3. **Malformed JSON path**: Cannot be directly triggered without a server — confirmed safe by code review
4. **Connected path**: Cannot be fully tested without a real server (will be integration-tested in ST-5.x when HeroAI connects)

The stub signal WARNs ("declared but never used") from Godot should **disappear** after this story, because the signals will be emitted in `_handle_server_message()`.

### Scope Boundary

| Feature | Story |
|---|---|
| REST HTTP client | ST-3.5 |
| HeroAI consuming these signals | ST-5.4+ |
| HUD consuming stamina/reward signals | ST-7.3 |
| Message queue / retry | Not planned |

### Key Learnings from ST-3.x Series

From ST-3.1/3.2/3.3 code reviews:
- Guard uses `_connected` (not `_websocket != null`) — `_websocket` may be non-null during STATE_CONNECTING
- `_websocket = null` is set in STATE_CLOSED — guard packet loop to STATE_OPEN only to avoid NPE
- `elif not _reconnecting:` guard in STATE_CLOSED — prevents spurious WARNs during reconnect retries
- `var _unused :=` pattern for intentional return value discard (not needed here)
- All WARN calls: `AppLogger.warn("ServerAPI", "message", {dict_data})`

### References

- Story requirements: [Source: _bmad-output/epics/epic-3-server-api.md#ST-3.4]
- Signal declarations: [Source: autoloads/server_api.gd:3-9]
- WebSocket receive API: Godot 4 docs — `WebSocketPeer.get_available_packet_count()`, `get_packet()`
- JSON parse API: Godot 4 docs — `JSON.parse_string()`
- No-await-in-process rule: [Source: _bmad-output/project-context.md#await-Coroutines]
- WebSocket polling rule: [Source: _bmad-output/project-context.md#WebSocket-Network]
- Autoload boundary rules: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- Previous story (outgoing): [Source: _bmad-output/implementation-artifacts/3-3-outgoing-message-protocol.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test run: `[INFO] [Main] Game started`, `[INFO] [DebugPanel] Debug panel ready` ✅
- All 5 stub signal WARNs from server_api.gd (`bomb_validated`, `stamina_updated`, `reward_received`, `hero_move_confirmed`, `hero_move_rejected`) **no longer appear** — confirms signals are now referenced via emit() calls ✅
- No parse errors ✅
- Pre-existing unrelated WARNs only: `transaction_confirmed` (web3_manager.gd), UID warning (main.tscn)

### Completion Notes List

1. **`_handle_server_message(data: Dictionary)`** — private method with `match type:` dispatch for all 5 server message types. Each branch guards required fields with `has_all()`/`has()`, logs WARN on missing fields, then emits the typed signal. `_:` default branch logs WARN for unknown types.

2. **Packet reading loop** — added to `_process()` STATE_OPEN branch after the `_connected` guard. Uses `get_available_packet_count() > 0` loop, decodes via `get_packet().get_string_from_utf8()`, parses with `JSON.parse_string()`, guards null/non-Dictionary, calls `_handle_server_message()`.

3. **`float()` cast** — used on `new_value` and `bcoin_amount` fields, defensive against JSON integer/float ambiguity when whole numbers are sent.

4. **`data.get("type", "")` pattern** — safely returns empty string when `type` key is missing, which falls through to `_:` default WARN branch without crashing.

5. **AC verification**:
   - AC1: Packet loop in STATE_OPEN `_process()` ✅
   - AC2: `get_packet().get_string_from_utf8()` + `JSON.parse_string()` ✅
   - AC3: `data == null or not data is Dictionary` → WARN + continue ✅
   - AC4: `"hero_move_confirmed"` → `hero_move_confirmed.emit(hero_id, Vector2i(x,y))` ✅
   - AC5: `"hero_move_rejected"` → `hero_move_rejected.emit(hero_id)` ✅
   - AC6: `"bomb_validated"` → `bomb_validated.emit(hero_id, Vector2i(x,y), chest_destroyed)` ✅
   - AC7: `"stamina_updated"` → `stamina_updated.emit(hero_id, float(new_value))` ✅
   - AC8: `"reward_received"` → `reward_received.emit(hero_id, float(bcoin_amount))` ✅
   - AC9: `_:` branch → WARN unknown type ✅
   - AC10: `has_all()`/`has()` guards → WARN + return on missing fields ✅

### File List

- `autoloads/server_api.gd` — modified (added `_handle_server_message()` + packet reading loop in `_process()`)
- `src/core/main.gd` — cosmetic fix (trailing blank line removed)

## Code Review Record

### Issues Found and Fixed

**M1: Stale docstring on `connect_to_server()`**
- `server_api.gd:21`: `## ST-3.4 adds packet reading.` — ST-3.4 is now complete
- Fixed: Updated to `## ST-3.5 adds REST HTTP client.`

**M2: `hero_id` not cast to `int()` — inconsistent defensive typing**
- All 5 emit branches passed `data["hero_id"]` as uncast Variant. JSON may deliver numeric values as `float` when sent as `3.0`. The typed signal parameters expect `hero_id: int` — passing a float would cause a runtime type mismatch.
- Fixed: `int(data["hero_id"])` applied to all 5 emit calls (lines 103, 108, 113, 118, 123) — consistent with the `float()` cast pattern already applied to `new_value` and `bcoin_amount`.

**L1: `main.gd` trailing blank line (pre-existing cosmetic)**
- Removed extra blank line at EOF — no functional change.

### Post-Fix Verification

- Project run: clean ✅ (only pre-existing unrelated WARNs — no regressions)
- No new parse errors ✅
