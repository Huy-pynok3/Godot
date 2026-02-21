---
epic: 5
title: "Hero System & AI Idle Loop"
status: "ready"
priority: "critical"
depends_on: [2, 3, 4]
---

# Epic 5: Hero System & AI Idle Loop

## Mục tiêu

Implement hệ thống hero đầy đủ: spawn từ NFT data, AI tự động di chuyển trên grid, đặt bomb, và phản ứng với server confirmations. Đây là gameplay core — sau epic này game phải "chơi được" ở mức cơ bản với mock server.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Hero spawn từ `HeroData` (stats từ NFT cache)
- [ ] Hero tự di chuyển trên grid với staggered timer theo Speed stat
- [ ] Hero gửi `move_intent` lên server, xử lý `confirmed`/`rejected` đúng pattern
- [ ] Hero phát hiện chest gần và gửi `bomb_intent` lên server
- [ ] Tối đa 15 heroes chạy đồng thời không lag
- [ ] `HeroState` enum hoạt động đúng — không tick mới khi đang chờ server

## User Stories

### ST-5.1 — HeroFactory
**As a** TreasureHunt scene,
**I want** spawn hero từ `HeroData` với một lệnh đơn giản,
**So that** không cần biết chi tiết setup bên trong Hero node.

**Acceptance Criteria:**
- `HeroFactory.create(token_id: int, stats: HeroData, spawn_cell: Vector2i) -> Hero`
- Hero được instantiate từ `res://scenes/treasure_hunt/hero.tscn`
- `hero.initialize(token_id, stats, spawn_cell)` được gọi trong factory
- Hero không được add_child trong factory — scene parent tự add
- Mỗi hero nhận `HeroData` riêng (không share instance)

### ST-5.2 — Hero Node (Visual Container)
**As a** player,
**I want** nhìn thấy hero sprite di chuyển trên grid,
**So that** có visual feedback cho AI hoạt động.

**Acceptance Criteria:**
- `Hero` node có Sprite2D với animation idle/walk
- `hero.move_to(cell: Vector2i)` — tween sprite đến pixel position của cell
- Hero hiển thị stamina bar nhỏ phía trên
- `hero.initialize(token_id, stats, spawn_cell)` set initial position và attach HeroAI

### ST-5.3 — HeroAI: Staggered Timer & Grid Movement
**As a** game,
**I want** mỗi hero tự tick theo Speed stat với offset ngẫu nhiên lúc spawn,
**So that** 15 heroes không tất cả di chuyển cùng một lúc.

**Acceptance Criteria:**
- Mỗi `HeroAI` có `Timer` riêng với interval = `data.get_move_interval()`
- Timer start sau random offset `randf_range(0.0, 2.0)` giây khi spawn
- `enum HeroState { IDLE, MOVING, WAITING_BOMB_CONFIRM, RESTING }`
- `_on_tick_timer_timeout()` — return ngay nếu `state != HeroState.IDLE`
- Chọn cell target: random trong các adjacent cells hợp lệ (4 hướng, trong bounds, cell free)
- Nếu không có cell free: skip tick, giữ nguyên vị trí

### ST-5.4 — HeroAI: Optimistic Move với Server Validation
**As a** hero AI,
**I want** di chuyển ngay lập tức (optimistic) nhưng rollback nếu server reject,
**So that** gameplay cảm thấy responsive dù server-authoritative.

**Acceptance Criteria:**
- Khi tick: gọi `hero_node.move_to(target)` + `GridMap.reserve_cell(target)` NGAY (optimistic)
- Gửi `ServerAPI.send_move_intent(hero_id, target)`
- `state = HeroState.MOVING`
- `_on_move_confirmed`: `GridMap.confirm_cell()` → `state = IDLE` → check bomb opportunity
- `_on_move_rejected`: `hero_node.move_to(current_cell)` (snap back) → `GridMap.release_cell(reserved_cell)` → `state = IDLE`
- Log WARN khi rejected, không log khi confirmed (tránh spam)

### ST-5.5 — HeroAI: Bomb Intent
**As a** hero AI,
**I want** phát hiện chest gần và gửi bomb intent lên server,
**So that** hero tự động đào vàng mà không cần player can thiệp.

**Acceptance Criteria:**
- Sau mỗi confirmed move, check adjacent cells xem có chest không
- Nếu có chest trong range (`data.range`): check `active_bombs < data.get_max_bombs()`
- Nếu có thể đặt bomb: gửi `ServerAPI.send_bomb_intent(hero_id, chest_cell)`
- `state = HeroState.WAITING_BOMB_CONFIRM`
- `_on_bomb_validated(hero_id, cell, chest_destroyed)`:
  - Spawn `Bomb` node tại cell → play animation
  - Nếu `chest_destroyed`: Chest node play destroy animation
  - `active_bombs -= 1` → `state = IDLE`
- Nếu server không confirm trong 5s: timeout → log WARN → `state = IDLE`

### ST-5.6 — Hero Stamina Display (Client Mirror)
**As a** player,
**I want** nhìn thấy stamina của từng hero giảm dần,
**So that** biết khi nào cần cho hero nghỉ.

**Acceptance Criteria:**
- `ServerAPI.stamina_updated(hero_id, new_value)` → Hero node update stamina bar
- Stamina bar hiển thị trên đầu hero (0–100%)
- Client KHÔNG tự giảm stamina — chỉ nhận từ server signal
- Khi stamina = 0: hero animate idle/sleep, không tick nữa (server sẽ gửi signal stop)
