# Story 3.3: Outgoing Message Protocol

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a hero AI,
I want to send move and bomb intents to the server in the correct JSON format,
so that the server can validate and respond to my actions.

## Acceptance Criteria

1. `ServerAPI.send_move_intent(hero_id: int, target_cell: Vector2i) -> void` — sends a JSON message via WebSocket
2. `ServerAPI.send_bomb_intent(hero_id: int, cell: Vector2i) -> void` — sends a JSON message via WebSocket
3. Message format for `send_move_intent`: `{ "type": "move_intent", "hero_id": <int>, "x": <int>, "y": <int> }`
4. Message format for `send_bomb_intent`: `{ "type": "bomb_intent", "hero_id": <int>, "x": <int>, "y": <int> }`
5. If WebSocket is not in STATE_OPEN (`_connected == false`): log WARN and drop the message — no queue, no crash, no retry
6. Sending only happens when called — these are NOT internal `_process()` loops; callers (HeroAI) invoke them; callers MUST NOT call them from `_physics_process()`
7. On `put_packet()` error (non-OK return): log WARN with the error code — do not crash

## Tasks / Subtasks

- [x] Task 1: Implement `send_move_intent(hero_id: int, target_cell: Vector2i) -> void` (AC: #1, #3, #5, #7)
  - [x] Guard: `if not _connected: AppLogger.warn("ServerAPI", "send_move_intent dropped — not connected", {"hero_id": hero_id}); return`
  - [x] Build message dict: `{ "type": "move_intent", "hero_id": hero_id, "x": target_cell.x, "y": target_cell.y }`
  - [x] Serialize: `var json := JSON.stringify(msg)`
  - [x] Send: `var err := _websocket.put_packet(json.to_utf8_buffer())`
  - [x] Check err: `if err != OK: AppLogger.warn("ServerAPI", "send_move_intent packet error", {"err": err})`

- [x] Task 2: Implement `send_bomb_intent(hero_id: int, cell: Vector2i) -> void` (AC: #2, #4, #5, #7)
  - [x] Guard: `if not _connected: AppLogger.warn("ServerAPI", "send_bomb_intent dropped — not connected", {"hero_id": hero_id}); return`
  - [x] Build message dict: `{ "type": "bomb_intent", "hero_id": hero_id, "x": cell.x, "y": cell.y }`
  - [x] Serialize: `var json := JSON.stringify(msg)`
  - [x] Send: `var err := _websocket.put_packet(json.to_utf8_buffer())`
  - [x] Check err: `if err != OK: AppLogger.warn("ServerAPI", "send_bomb_intent packet error", {"err": err})`

- [x] Task 3: Smoke test (temporary, debug only) (AC: all)
  - [x] Added temporary smoke test to `main.gd._ready()` inside `if OS.is_debug_build():`
  - [x] Verified: `[WARN] [ServerAPI] send_move_intent dropped — not connected — { "hero_id": 99 }` ✅ (AC #5 drop guard)
  - [x] Verified: `[INFO] [ServerAPI] Connecting to server` ✅ (existing connect flow unaffected)
  - [x] No parse errors ✅
  - [x] Smoke test removed from `main.gd`

## Dev Notes

### What This Story Does

Adds two public send methods to `ServerAPI` — the outgoing half of the game's WebSocket protocol. These are called by `HeroAI` during the idle loop:

- `send_move_intent()` — HeroAI sends when picking a target cell
- `send_bomb_intent()` — HeroAI sends when placing a bomb

This story does NOT implement:
- Incoming packet reading (ST-3.4)
- REST HTTP client (ST-3.5)
- Any queue or retry logic — drop and warn only

**This story modifies ONE file:**
- `autoloads/server_api.gd` — adds `send_move_intent()` and `send_bomb_intent()`

### Existing Code State (after ST-3.1 + ST-3.2 + code reviews)

**`autoloads/server_api.gd`** — current state:
```gdscript
extends Node

signal server_connected()
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()

var _websocket: WebSocketPeer
var _connected: bool = false
var _reconnecting: bool = false

func connect_to_server() -> void: ...
func _connect_websocket() -> bool: ...
func _attempt_reconnect() -> void: ...
func _process(_delta: float) -> void: ...
```

**Key ST-3.x learnings:**
- `_connected: bool` is the authoritative "we are in STATE_OPEN" flag — use it as the send guard, NOT `_websocket != null`
- `_websocket` may be non-null while STATE_CONNECTING — sending during STATE_CONNECTING would silently fail or error
- All WARN calls use the pattern: `AppLogger.warn("ServerAPI", "message", {dict_data})`
- `var _unused :=` pattern for intentional return value discard (not applicable here since we check `err`)

### CRITICAL: Godot 4 WebSocketPeer Send API

```gdscript
# Sending a WebSocket message in Godot 4:
var msg := {"type": "move_intent", "hero_id": 3, "x": 5, "y": 7}
var json := JSON.stringify(msg)
var err := _websocket.put_packet(json.to_utf8_buffer())
if err != OK:
    AppLogger.warn("ServerAPI", "Packet send error", {"err": err})
```

- `JSON.stringify(dict: Dictionary) -> String` — converts GDScript Dictionary to JSON string
- `String.to_utf8_buffer() -> PackedByteArray` — converts string to bytes
- `WebSocketPeer.put_packet(data: PackedByteArray) -> Error` — sends bytes; returns `OK` (0) on success
- The server receives the bytes and decodes as UTF-8 JSON — this is the standard text-mode WebSocket pattern

**DO NOT use:**
- `send_text()` — Godot 3 API; does not exist on `WebSocketPeer` in Godot 4
- `put_var()` — sends Godot binary format, not JSON

### CRITICAL: Message Format — Flat x/y, NOT nested

From epic-3:
```json
{ "type": "move_intent", "hero_id": 3, "x": 5, "y": 7 }
```

x and y are **top-level keys**, not nested in a `"position"` object. Implementation:
```gdscript
var msg := {
    "type": "move_intent",
    "hero_id": hero_id,
    "x": target_cell.x,
    "y": target_cell.y,
}
```

### CRITICAL: Guard Uses `_connected`, Not `_websocket != null`

`_websocket` may be non-null in STATE_CONNECTING (before connection is established). Attempting `put_packet()` during STATE_CONNECTING returns an error. Guard must use `_connected`:

```gdscript
# CORRECT:
if not _connected:
    AppLogger.warn("ServerAPI", "send_move_intent dropped — not connected", {"hero_id": hero_id})
    return

# WRONG — allows send during STATE_CONNECTING:
if _websocket == null:
    ...
```

### CRITICAL: AC #6 — Callers Must Not Use `_physics_process()`

From project-context.md: **"Never send WebSocket messages inside `_physics_process()` — use `_process()` only"**

`send_move_intent()` and `send_bomb_intent()` are called by `HeroAI` from a `Timer` callback — timers fire on the main thread (not physics thread), so this is safe. The constraint means HeroAI must never call these from `_physics_process()`.

The `ServerAPI` methods themselves have no enforcement mechanism for this — it's a caller contract. The story's Dev Notes document the rule; enforcement is HeroAI's responsibility (ST-5.x).

### CRITICAL: No Queuing — Drop and Warn Only

If not connected, messages are silently dropped (after logging WARN). This is intentional per AC #5 and per server-authoritative architecture: the idle loop will generate a new intent on the next tick. No message queue, no retry, no crash.

From project-context.md (Server Validation Failure Rule): "If the server rejects an action, the hero skips that action silently and logs at WARN level. No retry, no crash."

### Smoke Test Approach

No real server available. The smoke test verifies:
1. **Drop guard works**: Calling `send_move_intent()` before connecting → WARN "dropped — not connected" (AC #5) ✅
2. **No parse errors, no crash**: The two new methods compile and run cleanly ✅
3. **Connected path**: Cannot be tested without a real server (STATE_OPEN never reached). Will be integration-tested when server is available.

```gdscript
# Temporary smoke test for main.gd._ready() — remove after verification
if OS.is_debug_build():
    # Test drop guard (before connect)
    ServerAPI.send_move_intent(99, Vector2i(0, 0))  # Expect: WARN "dropped — not connected"
    # Start connection (no server → stays CONNECTING)
    ServerAPI.server_connected.connect(func():
        # This won't fire without a server — included to verify lambda parses
        ServerAPI.send_move_intent(1, Vector2i(3, 4))
        ServerAPI.send_bomb_intent(1, Vector2i(5, 6))
    )
    ServerAPI.connect_to_server()
```

### Scope Boundary

| Feature | Story |
|---|---|
| Reading incoming packets + parsing JSON | ST-3.4 |
| REST HTTP client | ST-3.5 |
| HeroAI calling these methods | ST-5.x |
| Queuing messages for later send | Not planned |

### References

- Story requirements: [Source: _bmad-output/epics/epic-3-server-api.md#ST-3.3]
- Message format: [Source: _bmad-output/epics/epic-3-server-api.md#ST-3.3 AC]
- WebSocket send rule (no physics_process): [Source: _bmad-output/project-context.md#WebSocket-Network]
- `ServerAPI` autoload: [Source: autoloads/server_api.gd]
- `WebSocketPeer.put_packet()` API: Godot 4 docs
- Drop-and-warn pattern: [Source: _bmad-output/project-context.md#Server-Validation-Failure-Rule]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[WARN] [ServerAPI] send_move_intent dropped — not connected — { "hero_id": 99 }` ✅ (AC #5 guard verified)
- Smoke test: `[INFO] [ServerAPI] Connecting to server — { "url": "ws://localhost:3000/ws" }` ✅ (existing flow unaffected)
- No parse errors. Pre-existing WARNINGs only (unused stub signals, UID warning). ✅
- send_move_intent backtrace shown in debug output at res://autoloads/server_api.gd:74 — confirms correct file location

### Completion Notes List

1. **`send_move_intent(hero_id, target_cell)`** — guards on `_connected`, builds flat `{type, hero_id, x, y}` dict, serializes with `JSON.stringify()`, sends via `put_packet(json.to_utf8_buffer())`, checks return error.

2. **`send_bomb_intent(hero_id, cell)`** — identical pattern with `"type": "bomb_intent"`.

3. **`_connected` guard** (not `_websocket != null`) — prevents accidental sends during STATE_CONNECTING where `put_packet()` would error.

4. **Flat x/y keys** — `"x": target_cell.x, "y": target_cell.y` matches epic spec exactly (not nested under `"position"`).

5. **AC verification**:
   - AC1: `send_move_intent()` declared and functional ✅
   - AC2: `send_bomb_intent()` declared and functional ✅
   - AC3: move_intent format `{type, hero_id, x, y}` ✅
   - AC4: bomb_intent format `{type, hero_id, x, y}` ✅
   - AC5: `if not _connected:` guard with WARN + return — smoke test confirmed ✅
   - AC6: methods are callable from HeroAI timer callbacks (not `_physics_process()`) — documented constraint ✅
   - AC7: `if err != OK: AppLogger.warn(...)` after `put_packet()` ✅

### File List

- `autoloads/server_api.gd` — modified (added `send_move_intent()`, `send_bomb_intent()`)
- `src/core/main.gd` — modified (smoke test added and removed — net clean)

## Code Review Record

### Issues Found and Fixed

**M1 + L2 (merged): Packet error WARNs missing debug context**
- Both `send_move_intent` and `send_bomb_intent` packet error WARNs previously only logged `{"err": err}`
- Fixed: Added `"hero_id"`, `"x"`, `"y"` to both error log dicts so failures are diagnosable
- `server_api.gd:79`: `{"err": err, "hero_id": hero_id, "x": target_cell.x, "y": target_cell.y}`
- `server_api.gd:91`: `{"err": err, "hero_id": hero_id, "x": cell.x, "y": cell.y}`

**L1: Stale docstring on `connect_to_server()`**
- Comment read "ST-3.3 adds send; ST-3.4 adds packet reading" — ST-3.3 is now complete
- Fixed: Updated to `## ST-3.4 adds packet reading.`

### Post-Fix Verification

- Project run: clean ✅ (only pre-existing stub signal WARNs and UID warning — no regressions)
- No new parse errors ✅
