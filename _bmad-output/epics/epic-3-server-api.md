---
epic: 3
title: "Server API Layer (REST + WebSocket)"
status: "ready"
priority: "critical"
depends_on: [1]
---

# Epic 3: Server API Layer (REST + WebSocket)

## Mục tiêu

Implement `ServerAPI` autoload — lớp giao tiếp duy nhất giữa client Godot và backend server. WebSocket cho game loop real-time, REST cho blockchain/wallet operations. Đây là xương sống của kiến trúc server-authoritative.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] WebSocket kết nối được tới server (hoặc mock server) và nhận packets
- [ ] Auto-reconnect 3 lần với exponential backoff khi disconnect
- [ ] REST HTTP client gọi được API endpoints cơ bản
- [ ] Tất cả server messages được parse và emit ra đúng signal
- [ ] Không có script nào khác ngoài `ServerAPI` gọi `WebSocketPeer` trực tiếp

## User Stories

### ST-3.1 — WebSocket Connection Manager
**As a** game,
**I want** `ServerAPI` tự quản lý WebSocket lifecycle,
**So that** các system khác chỉ cần connect signals mà không cần biết về WebSocket.

**Acceptance Criteria:**
- `ServerAPI.connect_to_server()` khởi tạo `WebSocketPeer` và kết nối tới `NetworkConfig.WS_URL`
- `websocket.poll()` được gọi trong `_process()` của `ServerAPI`
- Kết nối thành công → log INFO, emit `server_connected`
- `WebSocketPeer` không được expose ra ngoài `ServerAPI`

### ST-3.2 — Auto-Reconnect Logic
**As a** player,
**I want** game tự reconnect khi mất kết nối,
**So that** không phải manually refresh browser khi internet tạm thời gián đoạn.

**Acceptance Criteria:**
- Khi WebSocket disconnect: tự động retry tối đa 3 lần
- Exponential backoff: 1s → 2s → 4s giữa mỗi lần retry
- Sau 3 lần thất bại: emit `connection_lost` signal → `GamePhaseStateMachine` chuyển về `LOBBY`
- Log WARN cho mỗi lần retry, log ERROR khi hết retry
- Không block main thread — dùng `await get_tree().create_timer(delay).timeout`

### ST-3.3 — Outgoing Message Protocol
**As a** hero AI,
**I want** gửi intents lên server theo đúng format,
**So that** server có thể validate và phản hồi.

**Acceptance Criteria:**
- `ServerAPI.send_move_intent(hero_id: int, target_cell: Vector2i)` → gửi JSON qua WebSocket
- `ServerAPI.send_bomb_intent(hero_id: int, cell: Vector2i)` → gửi JSON qua WebSocket
- Message format: `{ "type": "move_intent", "hero_id": 3, "x": 5, "y": 7 }`
- Nếu WebSocket chưa connected: log WARN, drop message (không queue, không crash)
- Chỉ gửi trong `_process()` — không gửi từ `_physics_process()`

### ST-3.4 — Incoming Message Parser & Signal Emitter
**As a** HeroAI/HUD,
**I want** nhận server confirmations qua typed signals,
**So that** không cần parse JSON thô trong game logic.

**Acceptance Criteria:**
- `ServerAPI` parse JSON từ WebSocket packets mỗi frame
- `"hero_move_confirmed"` → emit `hero_move_confirmed(hero_id: int, position: Vector2i)`
- `"hero_move_rejected"` → emit `hero_move_rejected(hero_id: int)`
- `"bomb_validated"` → emit `bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)`
- `"stamina_updated"` → emit `stamina_updated(hero_id: int, new_value: float)`
- `"reward_received"` → emit `reward_received(hero_id: int, bcoin_amount: float)`
- Message type không nhận ra: log WARN, bỏ qua

### ST-3.5 — REST HTTP Client
**As a** game,
**I want** gọi REST API cho các operations không real-time,
**So that** minting, claiming rewards, và session auth không cần WebSocket.

**Acceptance Criteria:**
- `ServerAPI.post(endpoint: String, body: Dictionary) -> void` — gửi HTTP POST, emit kết quả qua signal
- `ServerAPI.get_request(endpoint: String) -> void` — gửi HTTP GET
- Dùng Godot's `HTTPClient` (browser-compatible)
- Timeout sau 10 giây, emit error signal nếu timeout
- Base URL lấy từ `NetworkConfig.API_BASE_URL`
