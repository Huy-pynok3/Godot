# Story 3.1: WebSocket Connection Manager

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a game,
I want `ServerAPI` to self-manage the WebSocket lifecycle,
so that other systems only need to connect to signals without knowing about WebSocket internals.

## Acceptance Criteria

1. `ServerAPI.connect_to_server() -> void` — initiates a `WebSocketPeer` connection to `NetworkConfig.WS_URL`
2. `websocket.poll()` is called every frame inside `ServerAPI._process()` — this is mandatory for Godot 4 WebSocket to receive data
3. When connection succeeds (state transitions to `STATE_OPEN`): log INFO, emit `server_connected` signal
4. `WebSocketPeer` instance is a private member variable — never exposed outside `ServerAPI`
5. `server_connected` signal is declared on `ServerAPI` with no parameters
6. On non-connected state: `_process()` polls safely without crashing (guard against null `_websocket`)
7. Calling `connect_to_server()` while already connected: log WARN and return without creating a second connection

## Tasks / Subtasks

- [x] Task 1: Add `server_connected` signal and `_websocket` member variable to `autoloads/server_api.gd` (AC: #4, #5)
  - [x] Add `signal server_connected()` to the existing signal list
  - [x] Add `var _websocket: WebSocketPeer` as a private member variable (initialized to `null`)

- [x] Task 2: Implement `connect_to_server() -> void` (AC: #1, #7)
  - [x] Guard: if `_websocket != null and _websocket.get_ready_state() == WebSocketPeer.STATE_OPEN`: log WARN "Already connected" and return
  - [x] Create `_websocket = WebSocketPeer.new()`
  - [x] Call `_websocket.connect_to_url(NetworkConfig.WS_URL)` — check return value (returns `Error`)
  - [x] If connect_to_url returns error code != OK: log WARN with error code, set `_websocket = null`, return
  - [x] Log INFO: `AppLogger.info("ServerAPI", "Connecting to server", {"url": NetworkConfig.WS_URL})`

- [x] Task 3: Implement `_process(delta: float)` with poll loop (AC: #2, #3, #6)
  - [x] Guard: `if _websocket == null: return`
  - [x] Call `_websocket.poll()` every frame — mandatory for state machine to advance
  - [x] Check `_websocket.get_ready_state()`:
    - `STATE_OPEN`: if not yet flagged as connected, log INFO "Connected to server" and emit `server_connected`
    - `STATE_CLOSED`: handle disconnect (log WARN "Connection closed" — stub only; ST-3.2 adds reconnect)
    - `STATE_CONNECTING` / `STATE_CLOSING`: no action (wait)
  - [x] Track connection state with a `_connected: bool` member variable to avoid emitting `server_connected` on every frame
  - [x] Note: incoming packet reading goes in ST-3.4; do NOT add packet reading here

- [x] Task 4: Smoke test (temporary, debug only) (AC: all)
  - [x] Add temporary code to `main.gd._ready()` inside `if OS.is_debug_build():` that calls `ServerAPI.connect_to_server()`
  - [x] Connect to `ServerAPI.server_connected` signal and log on fire
  - [x] Run project — on PC with no server running, expect: INFO "Connecting to server" then WARN or silent STATE_CLOSED (no crash)
  - [x] Verify no parse errors, no crash
  - [x] Remove smoke test from `main.gd` after verification

## Dev Notes

### What This Story Does

Implements the WebSocket lifecycle foundation in `ServerAPI`:
1. `connect_to_server()` — creates `WebSocketPeer`, calls `connect_to_url()`
2. `_process()` — polls the socket every frame, detects `STATE_OPEN`, emits `server_connected`

This is the minimal viable connection layer. It does NOT implement:
- Reconnect logic (ST-3.2)
- Sending messages (ST-3.3)
- Parsing incoming messages (ST-3.4)
- REST HTTP client (ST-3.5)

**This story modifies ONE file:**
- `autoloads/server_api.gd` — adds signal, member vars, `connect_to_server()`, `_process()`

### Existing Code State

**`autoloads/server_api.gd`** — current stub:
```gdscript
extends Node

signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()
```

**Important:** `server_connected` signal does NOT exist yet — must be added in Task 1. The other 6 signals already exist (they generate "unused" warnings until ST-3.3/3.4 wires them up — expected).

**`config/network.gd`:**
```gdscript
const WS_URL := "ws://localhost:3000/ws"
const API_BASE_URL := "http://localhost:3000"
```
Both are local dev placeholders. The smoke test will attempt to connect to localhost — this will fail gracefully since no server is running on PC.

### CRITICAL: Godot 4 WebSocketPeer API

`WebSocketPeer` in Godot 4 works as a **state machine polled manually every frame**:

```gdscript
# Correct Godot 4 WebSocketPeer usage pattern:
var _websocket: WebSocketPeer

func connect_to_server() -> void:
    _websocket = WebSocketPeer.new()
    var err := _websocket.connect_to_url("ws://localhost:3000/ws")
    if err != OK:
        AppLogger.warn("ServerAPI", "Failed to initiate WebSocket", {"err": err})
        _websocket = null
        return
    AppLogger.info("ServerAPI", "Connecting to server", {"url": NetworkConfig.WS_URL})

func _process(_delta: float) -> void:
    if _websocket == null:
        return
    _websocket.poll()
    var state := _websocket.get_ready_state()
    match state:
        WebSocketPeer.STATE_OPEN:
            if not _connected:
                _connected = true
                AppLogger.info("ServerAPI", "Connected to server")
                server_connected.emit()
        WebSocketPeer.STATE_CLOSED:
            if _connected:
                _connected = false
                AppLogger.warn("ServerAPI", "Connection closed")
                # ST-3.2 adds reconnect logic here
```

**Key API points:**
- `WebSocketPeer.new()` — creates instance
- `.connect_to_url(url: String) -> Error` — returns `OK` (0) on successful initiation (NOT yet connected); returns non-zero error if URL is malformed or system error
- `.poll()` — MUST be called every frame; drives the internal state machine; without this, state never advances
- `.get_ready_state() -> int` — returns one of: `STATE_CONNECTING(0)`, `STATE_OPEN(1)`, `STATE_CLOSING(2)`, `STATE_CLOSED(3)`
- `.close(code, reason)` — graceful close
- `.get_available_packet_count() -> int` — check before reading (ST-3.4)
- `.get_packet() -> PackedByteArray` — read next packet (ST-3.4)

**DO NOT use these Godot 3 patterns:**
- `NetworkedMultiplayerENet` — Godot 3 only
- `WebSocketClient` — Godot 3 only; in Godot 4 it's `WebSocketPeer` directly
- `yield()` — use `await`

### CRITICAL: `_process()` Polling Rule

From project-context.md: **"WebSocketPeer must be polled every frame — call `websocket.poll()` in `_process()` then read packets"**

`ServerAPI` extends `Node` and is an autoload — it is always in the SceneTree and its `_process()` runs every frame automatically. No need to manually enable processing.

**Do NOT:**
- Call `poll()` from `_physics_process()` — project-context.md explicitly forbids this
- Call `poll()` from a `Timer` callback — misses frames, causes packet loss
- Use threads for WebSocket — HTML5 has no threads

### CRITICAL: `_connected` State Tracking

Without a `_connected: bool` flag, `STATE_OPEN` fires every frame and `server_connected` would be emitted hundreds of times per second. Track connection state:

```gdscript
var _connected: bool = false

func _process(_delta: float) -> void:
    if _websocket == null:
        return
    _websocket.poll()
    match _websocket.get_ready_state():
        WebSocketPeer.STATE_OPEN:
            if not _connected:      # <-- emit ONCE on first STATE_OPEN
                _connected = true
                server_connected.emit()
        WebSocketPeer.STATE_CLOSED:
            if _connected:          # <-- reset on disconnect
                _connected = false
                # ST-3.2 reconnect trigger goes here
```

### CRITICAL: `connect_to_url()` Return Value

`connect_to_url()` does NOT mean the connection is established — it only means the connection attempt was initiated. The actual connection result is detected in `_process()` when state reaches `STATE_OPEN` or `STATE_CLOSED`.

`connect_to_url()` returns an `Error` enum value (`OK` = 0 = success initiation). A non-OK return means the URL is malformed or a system-level error occurred (rare). Always check it.

### CRITICAL: `signal server_connected` Placement

Place `server_connected` signal with the other signals at the top of `server_api.gd`. The existing signals generate "declared but never used" warnings — this is expected and will persist until ST-3.3/3.4. Do NOT remove the existing signals.

### Architecture Signal Reference

From `server_api.gd` stub — existing signals (do NOT remove):
```gdscript
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()
```

Add to this list:
```gdscript
signal server_connected()
```

### Smoke Test Approach

Since no local server is running, `connect_to_url()` will succeed (returns OK — URL is valid), but the connection will never reach `STATE_OPEN`. The socket will sit in `STATE_CONNECTING` then close. This is the expected behavior:

```gdscript
# Expected PC smoke test output (no server running):
# [INFO] [ServerAPI] Connecting to server — { "url": "ws://localhost:3000/ws" }
# (no server_connected log — STATE_OPEN never reached)
# (possible WARN when STATE_CLOSED detected — depends on timing)
```

No crash = success. `server_connected` will NOT fire (server not running) — that's correct.

```gdscript
# Temporary smoke test for main.gd._ready() — remove after verification
if OS.is_debug_build():
    ServerAPI.server_connected.connect(func():
        AppLogger.info("Main", "ST-3.1 smoke: server_connected fired!")
    )
    ServerAPI.connect_to_server()
```

### Scope Boundary — What Goes in Later Stories

| Feature | Story |
|---|---|
| Auto-reconnect on disconnect | ST-3.2 |
| Sending `move_intent` / `bomb_intent` | ST-3.3 |
| Reading packets + parsing JSON + emitting typed signals | ST-3.4 |
| REST HTTP client | ST-3.5 |
| Actual `disconnect_from_server()` | ST-3.2 or later |

ST-3.1 only establishes the connection and detects `STATE_OPEN`. Everything else is future scope.

### Previous Story Intelligence (ST-2.x Learnings)

1. **Explicit `Variant` type annotation**: For any function returning `Variant` or untyped, use `var x: Variant = func()` not `:=`. Not directly applicable to WebSocketPeer API (which has typed returns), but applies to any `match` results or generic data.

2. **`_process()` is auto-enabled for autoloads**: `ServerAPI` extends `Node` and is added as an autoload — `_process()` runs automatically. No `set_process(true)` needed.

3. **Guard against null early**: Same pattern used in `NFTCache._read_cache()` — always null-check member variables before use.

4. **No test framework**: Smoke via temporary `AppLogger` in `main.gd._ready()`, remove after run. A connection to localhost with no server will show INFO + graceful close, not a crash.

5. **`AppLogger.error()` exists**: The architecture code example uses it. Verify `app_logger.gd` has an `error()` method before using it in ST-3.1 (if not, use `warn()`).

### Files NOT to Touch

- `config/network.gd` — `WS_URL` is a placeholder; leave as-is
- `autoloads/web3_manager.gd` — not in scope
- `autoloads/nft_cache.gd` — not in scope
- `src/hero/hero_data.gd` — not in scope
- Any scene file, UI file

### References

- Story requirements: [Source: _bmad-output/epics/epic-3-server-api.md#ST-3.1]
- WebSocket architecture: [Source: _bmad-output/game-architecture.md#Server-Communication]
- WebSocket Disconnect Rule + reconnect example: [Source: _bmad-output/game-architecture.md#Error-Handling]
- `ServerAPI` autoload location: [Source: autoloads/server_api.gd]
- `NetworkConfig.WS_URL`: [Source: config/network.gd:4]
- `websocket.poll()` in `_process()` rule: [Source: _bmad-output/project-context.md#WebSocket-Network]
- No threads in HTML5: [Source: _bmad-output/project-context.md#WebGL-HTML5-Constraints]
- `ServerAPI` is sole WebSocket accessor: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- Signal naming convention (past tense): [Source: _bmad-output/project-context.md#Naming-Conventions]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[INFO] [ServerAPI] Connecting to server — { "url": "ws://localhost:3000/ws" }` ✅
- Smoke test: `server_connected` did NOT fire (no server on localhost) — correct expected behavior ✅
- No parse errors. Pre-existing warnings only (unused stub signals, UID warning from main.tscn).

### Completion Notes List

1. **`server_connected` signal added** at top of signal list. Existing 6 signals preserved unchanged.

2. **`_connected: bool` flag** used to emit `server_connected` exactly once on STATE_OPEN transition, not every frame.

3. **`match` statement for state** — uses `WebSocketPeer.STATE_OPEN`, `STATE_CLOSED`, `STATE_CONNECTING`, `STATE_CLOSING` named constants. `STATE_CONNECTING` and `STATE_CLOSING` grouped with `pass` — no action while transitioning.

4. **`connect_to_server()` guard** checks `STATE_OPEN` **and `STATE_CONNECTING`** — prevents orphaning an in-flight socket. If either state is active, logs WARN and returns without overwriting.

5. **`STATE_CLOSED` branch** now handles two sub-cases: (a) was connected → `_connected = false` + WARN "connection closed" + ST-3.2 stub; (b) never connected → WARN "connection attempt failed". In both cases, `_websocket = null` to stop polling the dead socket.

5. **ST-3.2 reconnect stub comment** placed at `STATE_CLOSED` branch — clearly marks where reconnect logic plugs in.

6. **AC verification**:
   - AC1: `connect_to_server()` creates `WebSocketPeer` and calls `connect_to_url(NetworkConfig.WS_URL)` ✅
   - AC2: `_websocket.poll()` called in `_process()` every frame ✅
   - AC3: `STATE_OPEN` → INFO log + `server_connected.emit()` ✅
   - AC4: `_websocket` is private member var — no public getter ✅
   - AC5: `signal server_connected()` declared ✅
   - AC6: `_process()` guards `if _websocket == null: return` ✅
   - AC7: Already-connected guard: checks `STATE_OPEN` **and `STATE_CONNECTING`**, logs WARN, returns ✅

### Code Review Fixes Applied

- **M2**: Guard in `connect_to_server()` expanded to block calls during `STATE_CONNECTING` — prevents orphaning an in-flight socket
- **M3**: `STATE_CLOSED` branch now logs WARN "connection attempt failed" when closed without ever reaching `STATE_OPEN`
- **L1**: `_websocket = null` set in `STATE_CLOSED` branch — stops polling dead socket every frame
- **M1 (doc)**: `src/core/main.gd` added to File List (smoke test added and removed — net clean)

### File List

- `autoloads/server_api.gd` — modified (added `server_connected` signal, `_websocket`, `_connected`, `connect_to_server()`, `_process()`; code-review fixes: STATE_CONNECTING guard, silent-failure log, null-on-close)
- `src/core/main.gd` — modified (smoke test added and removed — net clean)
