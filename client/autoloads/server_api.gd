extends Node

signal server_connected()
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()
signal chest_spawned(cell: Vector2i)
signal http_response_received(endpoint: String, status_code: int, body: Dictionary)
signal http_request_failed(endpoint: String, status_code: int, error_body: String)

## Private WebSocket instance — never expose outside ServerAPI.
var _websocket: WebSocketPeer
## Tracks whether we have reached STATE_OPEN to avoid emitting server_connected every frame.
var _connected: bool = false
## True while a reconnect coroutine is running — prevents duplicate reconnect goroutines.
var _reconnecting: bool = false

## REST HTTP client state — null when no request is in flight.
var _http: HTTPClient
var _http_endpoint: String = ""
var _http_body: String = ""
var _http_method: HTTPClient.Method = HTTPClient.METHOD_GET
var _http_timeout_timer: float = 0.0
var _http_body_bytes: PackedByteArray  ## Accumulates response body chunks across frames.
var _http_status_code: int = 0        ## Cached response code set when STATUS_BODY begins.
const HTTP_TIMEOUT_SECONDS := 10.0


## Public entry point: initiates a WebSocket connection to NetworkConfig.WS_URL.
## Call from user gesture or session start — NOT from _ready().
func connect_to_server() -> void:
	if _reconnecting:
		AppLogger.warn("ServerAPI", "Reconnect already in progress — ignoring connect_to_server() call")
		return
	if _websocket != null:
		var state := _websocket.get_ready_state()
		if state == WebSocketPeer.STATE_OPEN or state == WebSocketPeer.STATE_CONNECTING:
			AppLogger.warn("ServerAPI", "connect_to_server() called while already connected or connecting")
			return
	var _unused := _connect_websocket()


## Creates a new WebSocketPeer and initiates connection.
## Returns true if connect_to_url() returned OK (attempt started), false on error.
## Does NOT wait for STATE_OPEN — _process() detects that.
func _connect_websocket() -> bool:
	_websocket = WebSocketPeer.new()
	var err := _websocket.connect_to_url(NetworkConfig.WS_URL)
	if err != OK:
		AppLogger.warn("ServerAPI", "Failed to initiate WebSocket connection", {"err": err, "url": NetworkConfig.WS_URL})
		_websocket = null
		return false
	AppLogger.info("ServerAPI", "Connecting to server", {"url": NetworkConfig.WS_URL})
	return true


## Auto-reconnect coroutine: retries up to 3 times with exponential backoff (1s, 2s, 4s).
## Called fire-and-forget (without await) from _process() STATE_CLOSED branch.
## Emits connection_lost after all retries fail.
func _attempt_reconnect() -> void:
	_reconnecting = true
	for attempt in range(3):
		var delay := pow(2.0, attempt)
		AppLogger.warn("ServerAPI", "WebSocket reconnect attempt", {"attempt": attempt + 1, "delay_s": delay})
		await get_tree().create_timer(delay).timeout
		if not _connect_websocket():
			continue
		# Wait for socket to resolve out of STATE_CONNECTING
		while _websocket != null and _websocket.get_ready_state() == WebSocketPeer.STATE_CONNECTING:
			await get_tree().process_frame
		if _websocket != null and _websocket.get_ready_state() == WebSocketPeer.STATE_OPEN:
			_reconnecting = false
			return  # Success — _process() will detect STATE_OPEN and emit server_connected
	AppLogger.error("ServerAPI", "WebSocket reconnect failed after 3 attempts")
	connection_lost.emit()
	_reconnecting = false


## Sends a move intent to the server for the given hero targeting the given cell.
## Drops silently (with WARN) if not connected. Called by HeroAI — never from _physics_process().
func send_move_intent(hero_id: int, target_cell: Vector2i) -> void:
	if not _connected:
		AppLogger.warn("ServerAPI", "send_move_intent dropped — not connected", {"hero_id": hero_id})
		return
	var msg := {"type": "move_intent", "hero_id": hero_id, "x": target_cell.x, "y": target_cell.y}
	var err := _websocket.put_packet(JSON.stringify(msg).to_utf8_buffer())
	if err != OK:
		AppLogger.warn("ServerAPI", "send_move_intent packet error", {"err": err, "hero_id": hero_id, "x": target_cell.x, "y": target_cell.y})


## Sends a bomb intent to the server for the given hero at the given cell.
## Drops silently (with WARN) if not connected. Called by HeroAI — never from _physics_process().
func send_bomb_intent(hero_id: int, cell: Vector2i) -> void:
	if not _connected:
		AppLogger.warn("ServerAPI", "send_bomb_intent dropped — not connected", {"hero_id": hero_id})
		return
	var msg := {"type": "bomb_intent", "hero_id": hero_id, "x": cell.x, "y": cell.y}
	var err := _websocket.put_packet(JSON.stringify(msg).to_utf8_buffer())
	if err != OK:
		AppLogger.warn("ServerAPI", "send_bomb_intent packet error", {"err": err, "hero_id": hero_id, "x": cell.x, "y": cell.y})


## Sends an HTTP POST to the given endpoint with a JSON body.
## Drops with WARN if a request is already in flight — no queue, no retry.
func post(endpoint: String, body: Dictionary) -> void:
	if _http != null:
		AppLogger.warn("ServerAPI", "HTTP request already in progress — dropping new request", {"endpoint": endpoint})
		return
	var json_body := JSON.stringify(body)
	_start_http_request(HTTPClient.METHOD_POST, endpoint, json_body)


## Sends an HTTP GET to the given endpoint.
## Drops with WARN if a request is already in flight — no queue, no retry.
func get_request(endpoint: String) -> void:
	if _http != null:
		AppLogger.warn("ServerAPI", "HTTP request already in progress — dropping new request", {"endpoint": endpoint})
		return
	_start_http_request(HTTPClient.METHOD_GET, endpoint, "")


## Initiates an HTTP request. Parses NetworkConfig.API_BASE_URL for host/port.
## Stores request state; polling is driven by _poll_http() in _process().
func _start_http_request(method: HTTPClient.Method, endpoint: String, body_str: String) -> void:
	_http = HTTPClient.new()
	_http_endpoint = endpoint
	_http_body = body_str
	_http_method = method
	_http_timeout_timer = 0.0
	_http_body_bytes = PackedByteArray()
	_http_status_code = 0
	var base_url := NetworkConfig.API_BASE_URL
	var is_https := base_url.begins_with("https://")
	var url_no_scheme := base_url.replace("https://", "").replace("http://", "")
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
		_http.connect_to_host(host, port, TLSOptions.client())
	else:
		_http.connect_to_host(host, port)
	AppLogger.info("ServerAPI", "HTTP request started", {"method": method, "endpoint": endpoint})


## Reads one response body chunk this frame and accumulates into _http_body_bytes.
## Called from _poll_http() every frame while STATUS_BODY. Emits signal when done.
func _read_http_response_chunk() -> void:
	if _http_status_code == 0:
		_http_status_code = _http.get_response_code()
	var chunk := _http.read_response_body_chunk()
	if chunk.size() > 0:
		_http_body_bytes.append_array(chunk)
	# Status leaves STATUS_BODY when all chunks are consumed — emit then.
	if _http.get_status() != HTTPClient.STATUS_BODY:
		var body_str := _http_body_bytes.get_string_from_utf8()
		if _http_status_code >= 200 and _http_status_code < 300:
			var parsed = JSON.parse_string(body_str)
			var body_dict: Dictionary = parsed if parsed is Dictionary else {}
			http_response_received.emit(_http_endpoint, _http_status_code, body_dict)
		else:
			http_request_failed.emit(_http_endpoint, _http_status_code, body_str)
		_reset_http()


## Cleans up HTTP client state after a request completes or fails.
func _reset_http() -> void:
	if _http != null:
		_http.close()
	_http = null
	_http_endpoint = ""
	_http_body = ""
	_http_method = HTTPClient.METHOD_GET
	_http_body_bytes = PackedByteArray()
	_http_status_code = 0
	_http_timeout_timer = 0.0


## Drives the HTTPClient state machine each frame. Called from _process().
func _poll_http(delta: float) -> void:
	if _http == null:
		return
	_http_timeout_timer += delta
	if _http_timeout_timer >= HTTP_TIMEOUT_SECONDS:
		AppLogger.warn("ServerAPI", "HTTP request timed out", {"endpoint": _http_endpoint})
		http_request_failed.emit(_http_endpoint, -1, "timeout")
		_reset_http()
		return
	_http.poll()
	match _http.get_status():
		HTTPClient.STATUS_CONNECTING:
			pass  # Waiting for TCP connection
		HTTPClient.STATUS_CONNECTED:
			var headers := PackedStringArray(["Content-Type: application/json"])
			var err := _http.request(_http_method, _http_endpoint, headers, _http_body)
			if err != OK:
				AppLogger.warn("ServerAPI", "HTTP request() failed", {"endpoint": _http_endpoint, "err": err})
				http_request_failed.emit(_http_endpoint, -1, "request_failed")
				_reset_http()
		HTTPClient.STATUS_REQUESTING:
			pass  # Waiting for response headers
		HTTPClient.STATUS_BODY:
			_read_http_response_chunk()
		HTTPClient.STATUS_CONNECTION_ERROR, HTTPClient.STATUS_CANT_CONNECT, HTTPClient.STATUS_CANT_RESOLVE:
			AppLogger.warn("ServerAPI", "HTTP connection failed", {"endpoint": _http_endpoint})
			http_request_failed.emit(_http_endpoint, -1, "connection_failed")
			_reset_http()
		HTTPClient.STATUS_DISCONNECTED:
			pass  # Idle — request cycle complete


## Dispatches a parsed server message dict to the appropriate typed signal.
## Called from the _process() packet loop — no await, no blocking.
func _handle_server_message(data: Dictionary) -> void:
	var type: String = data.get("type", "")
	match type:
		"hero_move_confirmed":
			if not data.has_all(["hero_id", "x", "y"]):
				AppLogger.warn("ServerAPI", "hero_move_confirmed missing fields", {"data": data})
				return
			hero_move_confirmed.emit(int(data["hero_id"]), Vector2i(data["x"], data["y"]))
		"hero_move_rejected":
			if not data.has("hero_id"):
				AppLogger.warn("ServerAPI", "hero_move_rejected missing hero_id", {"data": data})
				return
			hero_move_rejected.emit(int(data["hero_id"]))
		"bomb_validated":
			if not data.has_all(["hero_id", "x", "y", "chest_destroyed"]):
				AppLogger.warn("ServerAPI", "bomb_validated missing fields", {"data": data})
				return
			bomb_validated.emit(int(data["hero_id"]), Vector2i(data["x"], data["y"]), data["chest_destroyed"])
		"stamina_updated":
			if not data.has_all(["hero_id", "new_value"]):
				AppLogger.warn("ServerAPI", "stamina_updated missing fields", {"data": data})
				return
			stamina_updated.emit(int(data["hero_id"]), float(data["new_value"]))
		"reward_received":
			if not data.has_all(["hero_id", "bcoin_amount"]):
				AppLogger.warn("ServerAPI", "reward_received missing fields", {"data": data})
				return
			reward_received.emit(int(data["hero_id"]), float(data["bcoin_amount"]))
		"chest_spawned":
			if not data.has_all(["x", "y"]):
				AppLogger.warn("ServerAPI", "chest_spawned missing fields", {"data": data})
				return
			chest_spawned.emit(Vector2i(data["x"], data["y"]))
		_:
			AppLogger.warn("ServerAPI", "Unknown server message type", {"type": type})


func _process(delta: float) -> void:
	_poll_http(delta)
	if _websocket == null:
		return
	_websocket.poll()
	match _websocket.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			if not _connected:
				_connected = true
				AppLogger.info("ServerAPI", "Connected to server")
				server_connected.emit()
			while _websocket.get_available_packet_count() > 0:
				var raw := _websocket.get_packet().get_string_from_utf8()
				var data = JSON.parse_string(raw)
				if data == null or not data is Dictionary:
					AppLogger.warn("ServerAPI", "Malformed WebSocket packet", {"raw": raw})
					continue
				_handle_server_message(data)
		WebSocketPeer.STATE_CLOSED:
			if _connected:
				_connected = false
				AppLogger.warn("ServerAPI", "WebSocket connection closed")
				_attempt_reconnect()  # fire-and-forget coroutine — never await in _process()
			elif not _reconnecting:
				AppLogger.warn("ServerAPI", "WebSocket connection attempt failed")
			_websocket = null
		WebSocketPeer.STATE_CONNECTING, WebSocketPeer.STATE_CLOSING:
			pass  # Wait for state to resolve
