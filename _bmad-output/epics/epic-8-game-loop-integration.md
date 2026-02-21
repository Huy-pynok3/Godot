---
epic: 8
title: "Game Phase State Machine & Full Loop Integration"
status: "ready"
priority: "high"
depends_on: [3, 5, 6, 7]
---

# Epic 8: Game Phase State Machine & Full Loop Integration

## Mục tiêu

Kết nối tất cả các hệ thống lại thành một vòng chơi hoàn chỉnh: Lobby → Connect Wallet → Chọn Heroes → Treasure Hunt → Heroes AI chạy → Earn BCOIN → Stamina cạn → Rest → Recover → Quay lại Hunt. Save point này là milestone lớn nhất — game phải chơi được end-to-end.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Core loop chạy hoàn chỉnh: Lobby → TreasureHunt → Rest → Lobby
- [ ] Hero spawn, AI tick, bomb, chest destroy, reward — tất cả hoạt động với mock/real server
- [ ] `GameState` được update đúng ở mỗi phase transition
- [ ] BCOIN balance cập nhật chính xác theo server rewards
- [ ] Khi tất cả heroes hết stamina → auto-transition về Rest

## User Stories

### ST-8.1 — GamePhaseStateMachine Đầy đủ
**As a** game,
**I want** `GamePhaseStateMachine` điều phối các transitions đúng,
**So that** không có phase nào bị skip hoặc chạy song song.

**Acceptance Criteria:**
- 3 states: `LOBBY`, `TREASURE_HUNT`, `REST` với enter/exit logic rõ ràng
- `LOBBY → TREASURE_HUNT`: khi player nhấn Start Hunt với heroes đã chọn
- `TREASURE_HUNT → REST`: khi player nhấn Stop hoặc tất cả heroes hết stamina
- `REST → LOBBY`: khi player chọn xong heroes nghỉ
- `connection_lost` từ bất kỳ state nào → về `LOBBY`
- Không có direct scene change nào bên ngoài FSM

### ST-8.2 — Hero Spawn Batch khi vào TreasureHunt
**As a** TreasureHunt scene,
**I want** spawn đúng danh sách heroes đã chọn từ Lobby,
**So that** chỉ heroes được chọn mới tham gia hunt.

**Acceptance Criteria:**
- `GameState.active_hero_ids` chứa danh sách token_ids từ Lobby selection
- Khi enter `TREASURE_HUNT`: spawn heroes theo list từ `NFTCache.get_hero_stats()`
- Nếu cache miss cho một hero: log WARN, skip hero đó (không crash)
- Heroes spawn tại cells ngẫu nhiên từ `GridMap.get_free_spawn_cell()`
- `ServerAPI.connect_to_server()` được gọi khi bắt đầu session hunt

### ST-8.3 — BCOIN Reward Integration
**As a** player,
**I want** thấy BCOIN balance tăng mỗi khi hero phá được chest,
**So that** có phản hồi trực quan về tiến độ kiếm tiền.

**Acceptance Criteria:**
- `ServerAPI.reward_received(hero_id, bcoin_amount)` → `GameState.bcoin_balance += bcoin_amount`
- HUD BCOIN counter animate tăng (tween số lên)
- `GameState.bcoin_balance` chỉ tăng khi nhận signal từ server — không tự tính
- Session total BCOIN được persist trong `GameState` suốt phiên chơi

### ST-8.4 — Auto-Rest khi Stamina Cạn
**As a** game,
**I want** tự động dừng hero khi server báo stamina = 0,
**So that** hero không tiếp tục tick vô ích.

**Acceptance Criteria:**
- Khi `stamina_updated(hero_id, 0)`: HeroAI set `state = HeroState.RESTING`, dừng timer
- Hero animate trạng thái nghỉ (khác với idle)
- Khi tất cả heroes trong TreasureHunt đều `RESTING`: emit signal → FSM có thể auto-transition về `REST` (hoặc hỏi user)
- Khi vào `REST` phase: gửi REST request lên server cho từng hero

### ST-8.5 — Settings Persistence
**As a** player,
**I want** game nhớ volume và UI preferences giữa các lần chơi,
**So that** không phải cài lại mỗi session.

**Acceptance Criteria:**
- `user://settings.json` lưu: `{ "schema_version": 1, "volume": 0.8, "sfx_volume": 1.0 }`
- Load settings khi khởi động game
- Save settings khi thay đổi
- Chỉ `SettingsManager` (hoặc tích hợp vào `GameState`) đọc/ghi file này
