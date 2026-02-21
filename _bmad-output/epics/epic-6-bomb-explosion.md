---
epic: 6
title: "Bomb & Explosion System"
status: "ready"
priority: "high"
depends_on: [4, 5]
---

# Epic 6: Bomb & Explosion System

## Mục tiêu

Implement visual bomb system — chỉ là **client-side animation**. Server quyết định tất cả: bomb có hit không, chest có bị phá không. Client chỉ nhận signal và animate. Epic này nhỏ nhưng quan trọng để đảm bảo không có client-side game logic nằm trong bomb code.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Bomb node xuất hiện tại cell sau khi server confirm `bomb_validated`
- [ ] Explosion animation play sau countdown
- [ ] Nếu `chest_destroyed = true`: Chest node nhận lệnh destroy
- [ ] Bomb tự queue_free() sau khi animation xong
- [ ] Không có damage calculation nào trong `bomb.gd`

## User Stories

### ST-6.1 — Bomb Node (Visual Only)
**As a** player,
**I want** thấy bomb xuất hiện và nổ trên grid,
**So that** có visual feedback trực quan cho mỗi lần đặt bomb.

**Acceptance Criteria:**
- `Bomb` node có Sprite2D + AnimationPlayer với animations: `idle` (countdown), `explode`
- `bomb.initialize(cell: Vector2i, hero_id: int)` — đặt bomb tại đúng pixel position
- Countdown visual (nháy/timer indicator)
- Sau countdown: play `explode` animation → emit `bomb_exploded(cell)` signal → queue_free()
- Explosion radius visual = `data.range` (cosmetic only — server đã tính rồi)

### ST-6.2 — Bomb Spawn từ Server Confirmation
**As a** HeroAI,
**I want** bomb chỉ xuất hiện SAU KHI server confirm,
**So that** không bao giờ có bomb hiện ra mà server chưa validate.

**Acceptance Criteria:**
- `HeroAI._on_bomb_validated()` mới instantiate `Bomb` node — không instantiate trước
- Bomb được add_child vào TreasureHunt scene (không phải hero node)
- Nếu `chest_destroyed = false`: bomb nổ nhưng chest vẫn còn (miss)
- Nếu `chest_destroyed = true`: `bomb_exploded` signal trigger Chest destroy animation
- Không có logic "miss chance" hay "damage calculation" trong client code

### ST-6.3 — Explosion Effect & Chest Trigger
**As a** player,
**I want** thấy chest vỡ ra đúng lúc bomb nổ,
**So that** visual feedback khớp với game event thực tế.

**Acceptance Criteria:**
- `Chest.destroy()` được gọi từ TreasureHunt scene khi nhận `bomb_exploded(cell)` và `chest_destroyed = true`
- Explosion particle effect (hoặc sprite animation) tại cell bomb
- Sound effect: bomb explosion SFX play qua AudioServer
- Timing: chest destroy animation bắt đầu đúng lúc explosion frame hit
