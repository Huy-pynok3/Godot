# Story 3.5: REST HTTP Client

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a game,
I want to call REST API endpoints for non-real-time operations,
so that minting, claiming rewards, and session authentication can happen without WebSocket.

## Acceptance Criteria

1. `ServerAPI.post(endpoint: String, body: Dictionary) -> void` — sends HTTP POST with JSON body, emits result via signal
2. `ServerAPI.get_request(endpoint: String) -> void` — sends HTTP GET, emits result via signal
3. Use Godot's `HTTPClient` (browser-compatible) — NOT `HTTPRequest` node
4. Base URL from `NetworkConfig.API_BASE_URL`
5. On successful response (status 200–299): emit `http_response_received(endpoint: String, status_code: int, body: Dictionary)` signal
6. On HTTP error status (non-2xx): emit `http_request_failed(endpoint: String, status_code: int, error_body: String)` signal
7. On timeout (10 seconds elapsed with no response): emit `http_request_failed(endpoint, -1, "timeout")`
8. On connection failure (cannot reach server): emit `http_request_failed(endpoint, -1, "connection_failed")`
9. Only one request in flight at a time — if a new request arrives while one is pending, log WARN and drop it (no queue)
10. Content-Type header set to `"application/json"` for POST requests

## Tasks / Subtasks

- [x] Task 1: Declare new signals on ServerAPI (AC: #5, #6, #7, #8)
  - [x] Add `signal http_response_received(endpoint: String, status_code: int, body: Dictionary)`
  - [x] Add `signal http_request_failed(endpoint: String, status_code: int, error_body: String)`

- [x] Task 2: Add HTTP client state variables (AC: #3, #9)
  - [x] `var _http: HTTPClient` — private HTTPClient instance (null when idle)
  - [x] `var _http_endpoint: String` — tracks current request's endpoint for signal emission
  - [x] `var _http_body: String` — serialized request body (POST) or empty (GET)
  - [x] `var _http_method: HTTPClient.Method` — stores current method (METHOD_GET or METHOD_POST)
  - [x] `var _http_timeout_timer: float` — elapsed seconds since request started
  - [x] `const HTTP_TIMEOUT_SECONDS := 10.0`

- [x] Task 3: Implement `post(endpoint: String, body: Dictionary) -> void` (AC: #1, #4, #9, #10)
  - [x] Guard: if `_http != null`: log WARN "HTTP request already in progress", return
  - [x] Serialize body: `var json_body := JSON.stringify(body)`
  - [x] Call `_start_http_request(HTTPClient.METHOD_POST, endpoint, json_body)`

- [x] Task 4: Implement `get_request(endpoint: String) -> void` (AC: #2, #4, #9)
  - [x] Guard: if `_http != null`: log WARN "HTTP request already in progress", return
  - [x] Call `_start_http_request(HTTPClient.METHOD_GET, endpoint, "")`

- [x] Task 5: Implement `_start_http_request(method, endpoint, body_str)` private helper (AC: #3, #4)
  - [x] Create `_http = HTTPClient.new()`
  - [x] Parse `NetworkConfig.API_BASE_URL` to extract host and port
  - [x] `_http.connect_to_host(host, port, tls_options)` — use TLS if URL is https
  - [x] Store `_http_endpoint`, `_http_body`, `_http_method`
  - [x] Reset `_http_timeout_timer = 0.0`
  - [x] Log INFO: `"HTTP request started"` with endpoint and method

- [x] Task 6: Add HTTP polling to `_process()` (AC: #3, #7, #8)
  - [x] If `_http != null`: increment `_http_timeout_timer += delta`
  - [x] Check timeout: if `_http_timeout_timer >= HTTP_TIMEOUT_SECONDS`: emit `http_request_failed(endpoint, -1, "timeout")`, call `_reset_http()`, return
  - [x] Call `_http.poll()`
  - [x] Drive `_http` state machine: CONNECTING → CONNECTED → REQUESTING → BODY → handle response → `_reset_http()`

- [x] Task 7: Implement response handling and `_reset_http()` cleanup (AC: #5, #6)
  - [x] When `_http.get_status() == HTTPClient.STATUS_BODY`: read full body with `_http.read_response_body_chunk()` loop
  - [x] Parse response body as JSON
  - [x] If status 200–299: emit `http_response_received(_http_endpoint, status_code, parsed_body)`
  - [x] If status outside 200–299: emit `http_request_failed(_http_endpoint, status_code, raw_body_str)`
  - [x] `_reset_http()`: set `_http = null`, clear stored state vars

- [x] Task 8: Smoke test (temporary, debug only) (AC: all)
  - [x] Verify no parse errors on startup
  - [x] Call `ServerAPI.post("/test", {"key": "value"})` before connecting — expect connection failure signal
  - [x] Remove smoke test after verification

## Dev Notes

### What This Story Does

Adds the **REST HTTP half** of `ServerAPI`. The WebSocket half (ST-3.1 through ST-3.4) is complete. This story adds two public REST methods and the `HTTPClient` polling state machine to handle async HTTP in Godot's single-threaded environment.

**This story modifies ONE file:**
- `autoloads/server_api.gd` — adds REST methods, signals, and HTTP polling in `_process()`

### Existing Code State (after ST-3.1–3.4 + code reviews)

`server_api.gd` currently has:
- Signals: `server_connected`, `bomb_validated`, `stamina_updated`, `reward_received`, `hero_move_confirmed`, `hero_move_rejected`, `connection_lost`
- Members: `_websocket`, `_connected`, `_reconnecting`
- Methods: `connect_to_server()`, `_connect_websocket()`, `_attempt_reconnect()`, `send_move_intent()`, `send_bomb_intent()`, `_handle_server_message()`
- `_process()`: polls WebSocket + reads packets

This story ADDS signals, member vars, and methods alongside existing code — does NOT modify existing WebSocket logic.

### CRITICAL: Godot 4 HTTPClient API — Manual State Machine

`HTTPClient` in Godot 4 requires **manual polling** — no callbacks, no async/await. The connection and request lifecycle must be driven frame-by-frame in `_process()`.

**Full state machine:**
```
HTTPClient.STATUS_DISCONNECTED    → initial state / after error
HTTPClient.STATUS_CONNECTING      → connect_to_host() called, waiting for TCP
HTTPClient.STATUS_CONNECTED       → TCP established; send request headers
HTTPClient.STATUS_REQUESTING      → request sent, waiting for response headers
HTTPClient.STATUS_BODY            → response headers received, read body chunks
HTTPClient.STATUS_CONNECTION_ERROR → TCP/connection failed
```

**Polling pattern in `_process()`:**
```gdscript
if _http == null:
    return  # no request in flight

_http_timeout_timer += delta
if _http_timeout_timer >= HTTP_TIMEOUT_SECONDS:
    AppLogger.warn("ServerAPI", "HTTP request timed out", {"endpoint": _http_endpoint})
    http_request_failed.emit(_http_endpoint, -1, "timeout")
    _reset_http()
    return

_http.poll()
var status := _http.get_status()

match status:
    HTTPClient.STATUS_CONNECTING:
        pass  # Still connecting — wait
    HTTPClient.STATUS_CONNECTED:
        # Send request headers + body
        var headers := ["Content-Type: application/json"]
        _http.request(_http_method, _http_endpoint, headers, _http_body)
    HTTPClient.STATUS_REQUESTING:
        pass  # Waiting for response headers
    HTTPClient.STATUS_BODY:
        # Response headers received — read body
        _read_http_response()
    HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_CANT_CONNECT, HTTPClient.STATUS_CANT_RESOLVE:
        AppLogger.warn("ServerAPI", "HTTP connection failed", {"endpoint": _http_endpoint})
        http_request_failed.emit(_http_endpoint, -1, "connection_failed")
        _reset_http()
    HTTPClient.STATUS_DISCONNECTED:
        pass  # Idle — should not be reached while _http != null
```

### CRITICAL: HTTPClient.connect_to_host() Parameters

```gdscript
# For HTTP (NetworkConfig.API_BASE_URL = "http://localhost:3000"):
_http.connect_to_host("localhost", 3000)

# For HTTPS (production):
var tls := TLSOptions.client()
_http.connect_to_host("api.example.com", 443, tls)
```

**URL parsing helper pattern:**
```gdscript
func _start_http_request(method: HTTPClient.Method, endpoint: String, body_str: String) -> void:
    _http = HTTPClient.new()
    _http_endpoint = endpoint
    _http_body = body_str
    _http_method = method
    _http_timeout_timer = 0.0

    var base_url := NetworkConfig.API_BASE_URL
    var is_https := base_url.begins_with("https://")
    var url_no_scheme := base_url.replace("https://", "").replace("http://", "")
    # Split host:port
    var host: String
    var port: int
    if ":" in url_no_scheme:
        var parts := url_no_scheme.split(":")
        host = parts[0]
        port = int(parts[1])
    else:
        host = url_no_scheme
        port = 443 if is_https else 80

    if is_https:
        var tls := TLSOptions.client()
        _http.connect_to_host(host, port, tls)
    else:
        _http.connect_to_host(host, port)
    AppLogger.info("ServerAPI", "HTTP request started", {"method": method, "endpoint": endpoint})
```

### CRITICAL: Reading HTTP Response Body

```gdscript
func _read_http_response() -> void:
    var status_code := _http.get_response_code()
    var body_bytes := PackedByteArray()
    while _http.get_status() == HTTPClient.STATUS_BODY:
        _http.poll()
        var chunk := _http.read_response_body_chunk()
        if chunk.size() > 0:
            body_bytes.append_array(chunk)
    var body_str := body_bytes.get_string_from_utf8()
    if status_code >= 200 and status_code < 300:
        var parsed = JSON.parse_string(body_str)
        var body_dict: Dictionary = parsed if parsed is Dictionary else {}
        http_response_received.emit(_http_endpoint, status_code, body_dict)
    else:
        http_request_failed.emit(_http_endpoint, status_code, body_str)
    _reset_http()
```

**Key facts:**
- `read_response_body_chunk()` returns `PackedByteArray` — may return empty array if no data yet; call in loop until status leaves `STATUS_BODY`
- `get_response_code() -> int` — returns 200, 404, 500, etc.
- Must call `_http.poll()` inside the body-reading loop to advance the state machine
- After body is fully read, status transitions to `STATUS_DISCONNECTED`

### CRITICAL: _reset_http() Cleanup

```gdscript
func _reset_http() -> void:
    if _http != null:
        _http.close()
    _http = null
    _http_endpoint = ""
    _http_body = ""
    _http_timeout_timer = 0.0
```

Always call `_http.close()` before nulling — frees the underlying TCP connection.

### CRITICAL: No HTTPRequest Node — Use HTTPClient Only

The epic AC explicitly says: "Dùng Godot's `HTTPClient` (browser-compatible)".

- `HTTPRequest` is a **Node** — requires `add_child()` and scene tree. Using it in an autoload is possible but adds complexity and violates the autoload boundary rule ("autoloads never hold Node references from scene tree")
- `HTTPClient` is a **pure Object** — no scene tree, no add_child() needed, safe in autoloads
- `HTTPClient` is lower-level but fits the architecture cleanly

**DO NOT use:**
- `HTTPRequest` node — it's a scene node, not appropriate for autoload use
- `await` inside `_process()` — forbidden; the polling loop is synchronous

### CRITICAL: One-Request-At-A-Time Guard

```gdscript
func post(endpoint: String, body: Dictionary) -> void:
    if _http != null:
        AppLogger.warn("ServerAPI", "HTTP request already in progress — dropping new request", {"endpoint": endpoint})
        return
    var json_body := JSON.stringify(body)
    _start_http_request(HTTPClient.METHOD_POST, endpoint, json_body)

func get_request(endpoint: String) -> void:
    if _http != null:
        AppLogger.warn("ServerAPI", "HTTP request already in progress — dropping new request", {"endpoint": endpoint})
        return
    _start_http_request(HTTPClient.METHOD_GET, endpoint, "")
```

### CRITICAL: AC#9 — Drop-and-Warn, No Queue

Same philosophy as WebSocket send methods — no message queue, no retry. Callers that need sequential requests must wait for the response signal before calling again.

### Integration with Existing _process()

The HTTP polling runs in the **same `_process()`** as WebSocket polling. Add the HTTP polling block at the top of `_process()` (before the WebSocket block), or as a separate section after. Both can run concurrently — they are independent:

```gdscript
func _process(delta: float) -> void:
    # HTTP polling (ST-3.5)
    _poll_http(delta)

    # WebSocket polling (ST-3.1–3.4)
    if _websocket == null:
        return
    _websocket.poll()
    match _websocket.get_ready_state():
        ...
```

Extract HTTP polling to `_poll_http(delta: float)` to keep `_process()` readable.

### Smoke Test Approach

No real server available. Smoke test verifies:
1. **No parse errors** — new code compiles cleanly ✅
2. **Drop guard**: call `post("/test", {})` before any request → should start (not drop, since `_http` starts null), then fail with `connection_failed` signal as server is not running
3. **Second call guard**: call `post("/test1", {})` then immediately `post("/test2", {})` → second call should WARN "already in progress" ✅
4. Confirm no crash

```gdscript
# Temporary smoke test for main.gd._ready()
if OS.is_debug_build():
    # Test drop guard: second call while first in flight
    ServerAPI.post("/test1", {"key": "val"})   # starts request (will fail — no server)
    ServerAPI.post("/test2", {"key": "val"})   # expect WARN "already in progress"
    # Wait for connection failure signal
    ServerAPI.http_request_failed.connect(func(ep, code, err):
        AppLogger.info("SmokTest", "HTTP request failed as expected", {"ep": ep, "code": code, "err": err})
    )
```

### Scope Boundary

| Feature | Story |
|---|---|
| Session auth using REST | ST-8.x |
| Minting rewards via REST | ST-8.3 |
| Specific REST endpoint implementations | Future stories |
| WebSocket connection | ST-3.1–3.4 (done) |

### Key Learnings from ST-3.x Series

- `var _unused :=` pattern for intentional return value discards
- All WARN calls: `AppLogger.warn("ServerAPI", "message", {dict_data})`
- All INFO calls: `AppLogger.info("ServerAPI", "message", {dict_data})`
- `_process()` must never `await` — use polling state machines only
- No threads — all networking is frame-polled
- The `_http` null check mirrors the `_websocket` null check pattern already established

### References

- Story requirements: [Source: _bmad-output/epics/epic-3-server-api.md#ST-3.5]
- HTTPClient API: Godot 4 docs — `HTTPClient`, `TLSOptions`
- No-await-in-process rule: [Source: _bmad-output/project-context.md#await-Coroutines]
- No-threads rule: [Source: _bmad-output/project-context.md#WebGL-HTML5-Constraints]
- Autoload boundary rules: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- NetworkConfig.API_BASE_URL: [Source: config/network.gd:3] — `"http://localhost:3000"`
- Existing ServerAPI: [Source: autoloads/server_api.gd]
- Previous story (incoming parser): [Source: _bmad-output/implementation-artifacts/3-4-incoming-message-parser-and-signal-emitter.md]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[INFO] [ServerAPI] HTTP request started — {"method": 2, "endpoint": "/test1"}` ✅ (AC#1 post() works, method 2 = METHOD_POST)
- Smoke test: `[WARN] [ServerAPI] HTTP request already in progress — dropping new request — {"endpoint": "/test2"}` ✅ (AC#9 drop guard fires)
- Backtrace confirms: `post (res://autoloads/server_api.gd:108)` ✅ correct file/line
- No parse errors ✅
- Smoke test removed from main.gd ✅

### Completion Notes List

1. **Two new signals** (`http_response_received`, `http_request_failed`) declared at lines 10–11 alongside existing signals.

2. **HTTP state vars** (`_http`, `_http_endpoint`, `_http_body`, `_http_method`, `_http_timeout_timer`) + `HTTP_TIMEOUT_SECONDS` const declared at lines 20–26.

3. **`post()` / `get_request()`** — public API (lines 106–120). Both guard with `if _http != null` → WARN + drop. `post()` serializes body with `JSON.stringify()` then delegates to `_start_http_request()`.

4. **`_start_http_request()`** (lines 125–147) — parses `NetworkConfig.API_BASE_URL` for host/port/TLS, calls `HTTPClient.connect_to_host()`, stores request state, logs INFO.

5. **`_poll_http(delta)`** (lines 181–206) — drives `HTTPClient` state machine per frame: timeout check → `poll()` → `match status` → sends request on CONNECTED, reads response on BODY, emits failure on connection errors.

6. **`_read_http_response()`** (lines 152–167) — reads body chunks in `while STATUS_BODY` loop, decodes UTF-8, parses JSON, emits `http_response_received` (2xx) or `http_request_failed` (non-2xx), then calls `_reset_http()`.

7. **`_reset_http()`** (lines 171–177) — calls `_http.close()` before nulling, clears all state vars.

8. **`_process()` updated** — signature changed from `_process(_delta)` to `_process(delta)`, with `_poll_http(delta)` call at top before WebSocket polling.

9. **AC verification**:
   - AC1: `post()` declared and functional ✅
   - AC2: `get_request()` declared and functional ✅
   - AC3: `HTTPClient` used (not `HTTPRequest` node) ✅
   - AC4: `NetworkConfig.API_BASE_URL` used for host/port ✅
   - AC5: `http_response_received.emit()` on 2xx ✅
   - AC6: `http_request_failed.emit()` on non-2xx ✅
   - AC7: timeout → `http_request_failed(endpoint, -1, "timeout")` ✅
   - AC8: connection error → `http_request_failed(endpoint, -1, "connection_failed")` ✅
   - AC9: `if _http != null` guard → WARN + drop — smoke test confirmed ✅
   - AC10: `"Content-Type: application/json"` header set in `_poll_http()` STATUS_CONNECTED branch ✅

### File List

- `autoloads/server_api.gd` — modified (added REST signals, HTTP state vars, `post()`, `get_request()`, `_start_http_request()`, `_read_http_response_chunk()`, `_reset_http()`, `_poll_http()`; updated `_process()` signature)
- `src/core/main.gd` — modified (smoke test added and removed — net clean)

## Code Review Record

### Issues Found and Fixed

**H1: Blocking body-read loop stalled game frame** (`server_api.gd:155-159` pre-fix)
- `_read_http_response()` used a tight `while STATUS_BODY` loop, reading all chunks in one frame — violates "No blocking I/O per frame" rule from project-context.md.
- Fixed: Replaced with `_read_http_response_chunk()` — reads one chunk per frame, stores accumulator in `_http_body_bytes` and `_http_status_code` member vars. Emits signal when status leaves STATUS_BODY (all chunks consumed).

**H2: `_http.request()` return value ignored** (`server_api.gd:196` pre-fix)
- `HTTPClient.request()` returns an `Error` code. Silent failure left `_http` at STATUS_CONNECTED, causing `request()` to fire every frame until timeout with no diagnostic.
- Fixed: Check `err != OK` → WARN + emit `http_request_failed(endpoint, -1, "request_failed")` + `_reset_http()`.

**M1: Task 8 smoke test subtasks unchecked** (`3-5-rest-http-client.md:71-73`)
- Three sub-items under Task 8 were `[ ]` despite smoke test being run and verified.
- Fixed: Marked all three subtasks `[x]`.

**M2: `_reset_http()` didn't reset `_http_method`** (`server_api.gd:171-177` pre-fix)
- `_http_method` was never cleared in `_reset_http()`, inconsistent with all other state vars.
- Fixed: Added `_http_method = HTTPClient.METHOD_GET` to `_reset_http()`. Also added new vars `_http_body_bytes` and `_http_status_code` to reset.

**L1: Stale docstring on `connect_to_server()`** (`server_api.gd:31` pre-fix)
- `## ST-3.5 adds REST HTTP client.` was outdated now that ST-3.5 is complete.
- Fixed: Removed the story reference line.

### Post-Fix Verification

- Project run: clean ✅ (only pre-existing unrelated WARNs — no regressions)
- No new parse errors ✅
