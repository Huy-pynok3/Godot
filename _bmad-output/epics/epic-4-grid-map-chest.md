---
epic: 4
title: "Grid Map & Chest System"
status: "ready"
priority: "high"
depends_on: [1, 3]
---

# Epic 4: Grid Map & Chest System

## Mục tiêu

Xây dựng hệ thống grid — nền tảng để heroes di chuyển và chests được spawn. `GridMap` track cell occupancy, `Chest` node nhận lệnh từ server để animate. Không có physics — tất cả movement là grid-based.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Grid `Constants.GRID_SIZE` (20×15) hiển thị trên màn hình
- [ ] `GridMap` track được cell nào bị occupied bởi hero nào
- [ ] Chests spawn tại vị trí ngẫu nhiên theo lệnh server
- [ ] Chest animate destroy khi nhận signal `bomb_validated` với `chest_destroyed = true`
- [ ] `GridMap.get_free_spawn_cell()` trả về cell trống hợp lệ

## User Stories

### ST-4.1 — GridMap Core
**As a** hero AI,
**I want** query GridMap để biết cell nào available,
**So that** hero không đi vào cell đã occupied.

**Acceptance Criteria:**
- `GridMap` node quản lý Dictionary `{ Vector2i → hero_id }` cho occupied cells
- `GridMap.is_cell_free(cell: Vector2i) -> bool`
- `GridMap.reserve_cell(cell: Vector2i, hero_id: int)` — optimistic reservation
- `GridMap.confirm_cell(cell: Vector2i, hero_id: int)` — sau khi server confirm
- `GridMap.release_cell(cell: Vector2i, hero_id: int)` — giải phóng (move rejected hoặc hero rời đi)
- `GridMap.get_free_spawn_cell() -> Vector2i` — tìm cell trống ngẫu nhiên cho hero spawn
- Out-of-bounds check: cell phải nằm trong `[0, Constants.GRID_SIZE)`

### ST-4.2 — Grid Visual Render
**As a** player,
**I want** nhìn thấy grid map với tiles,
**So that** có thể hình dung hero đang ở đâu trên bản đồ.

**Acceptance Criteria:**
- Grid render đúng kích thước `Constants.GRID_SIZE` (20 cột × 15 hàng)
- Tile size được tính tự động để fit trong viewport
- Background tiles render (placeholder color hoặc sprite)
- Grid coordinates khớp với `Vector2i` logic trong `GridMap`

### ST-4.3 — Chest Node
**As a** player,
**I want** nhìn thấy chests xuất hiện trên grid và animate khi bị phá,
**So that** có visual feedback cho quá trình đào vàng.

**Acceptance Criteria:**
- `Chest` node có sprite và AnimationPlayer với 2 animations: `idle`, `destroy`
- Chest spawn tại cell chỉ định bởi server (qua scene instantiation hoặc signal)
- Khi nhận `ServerAPI.bomb_validated` với `chest_destroyed = true` tại đúng cell: play `destroy` animation → queue_free()
- Chest cell được đánh dấu blocked trong `GridMap` (heroes không đi vào)
- Nhiều chests có thể tồn tại cùng lúc

### ST-4.4 — Chest Spawning
**As a** game,
**I want** chests được spawn theo lệnh từ server,
**So that** client không tự quyết định chest nào xuất hiện.

**Acceptance Criteria:**
- Server gửi message `"chest_spawned"` với `cell` → `ServerAPI` emit signal → `TreasureHunt` scene instantiate `Chest` tại đó
- Số lượng chests trên màn hình giới hạn bởi server (client không tự spawn thêm)
- Nếu cell đã có hero: log WARN (server side bug), đặt chest ở cell gần nhất trống
