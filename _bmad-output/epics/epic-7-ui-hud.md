---
epic: 7
title: "UI/HUD & Game Screens"
status: "ready"
priority: "high"
depends_on: [2, 3, 5]
---

# Epic 7: UI/HUD & Game Screens

## Mục tiêu

Implement toàn bộ UI của game: Lobby (wallet connect + hero roster), HUD in-game (stamina bars, BCOIN counter, hero cards), và Rest screen. UI chỉ hiển thị — không có game logic nào trong UI scripts.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Lobby screen hiển thị wallet address và danh sách heroes sau khi connect
- [ ] HUD cập nhật stamina bars và BCOIN balance theo server signals
- [ ] Player có thể chọn heroes để send vào Treasure Hunt
- [ ] Rest screen hiển thị recovery progress
- [ ] Tất cả UI updates đến từ signals — không poll state trong `_process()`

## User Stories

### ST-7.1 — Lobby Screen
**As a** player,
**I want** thấy màn hình Lobby với nút Connect Wallet và danh sách heroes,
**So that** có thể chuẩn bị trước khi vào Treasure Hunt.

**Acceptance Criteria:**
- Nút "Connect Wallet" → gọi `Web3Manager.connect_wallet()`
- Sau `wallet_connected`: hiển thị địa chỉ ví (rút gọn: `0x1234...5678`)
- Danh sách hero cards hiển thị từ `NFTCache` sau khi metadata load xong
- Mỗi hero card: avatar placeholder, tên/ID, 5 stats, stamina bar, checkbox chọn
- Nút "Start Treasure Hunt" — chỉ enable khi có ít nhất 1 hero được chọn
- Tối đa `Constants.MAX_HEROES` (15) heroes được chọn cùng lúc

### ST-7.2 — HeroCard Widget
**As a** player,
**I want** thấy thông tin rõ ràng của từng hero,
**So that** biết hero nào đang khỏe, hero nào cần nghỉ.

**Acceptance Criteria:**
- `HeroCard` Control node: avatar, token_id, Power/Speed/Stamina/Range/BombCount labels
- Stamina bar visual (màu xanh → vàng → đỏ theo % stamina)
- State badge: "Active" / "Resting" / "Ready"
- Cập nhật stamina khi nhận `ServerAPI.stamina_updated(hero_id, new_value)`
- Chỉ update đúng card của hero đó (match hero_id)

### ST-7.3 — In-Game HUD
**As a** player,
**I want** HUD hiển thị tổng quan trong khi heroes đang hunt,
**So that** có thể monitor game mà không cần xem từng hero một.

**Acceptance Criteria:**
- BCOIN balance counter (cập nhật khi `reward_received` signal)
- Mini hero roster: 15 hero slots với stamina indicator nhỏ
- Server connection status indicator (connected/disconnected)
- Nút "Stop Hunt" → transition về Rest screen
- BCOIN display: client KHÔNG tự cộng — chỉ nhận từ `GameState.bcoin_balance` sau server push

### ST-7.4 — Rest Screen
**As a** player,
**I want** màn hình Rest để cho heroes nghỉ ngơi phục hồi stamina,
**So that** có thể send heroes trở lại hunt sau khi phục hồi.

**Acceptance Criteria:**
- Danh sách heroes với stamina bar đang tăng dần (theo server push)
- Timer hiển thị estimated time còn lại (informational only — server quyết định)
- Nút "Send to Hunt" per hero — chỉ enable khi stamina đủ (theo giá trị server)
- Nút "Rest All" / "Send All Ready"
- Transition về Lobby hoặc TreasureHunt khi user chọn

### ST-7.5 — Game Phase Transitions (UI side)
**As a** player,
**I want** chuyển cảnh mượt mà giữa Lobby → TreasureHunt → Rest,
**So that** game flow cảm thấy liền mạch.

**Acceptance Criteria:**
- `GamePhaseStateMachine` emit signal khi chuyển phase → scene load đúng
- Fade transition (0.3s) giữa các scenes
- Khi `connection_lost` signal: fade về Lobby, hiển thị "Connection lost. Reconnecting..."
- Không hardcode scene paths — dùng constants hoặc enum-driven scene dictionary
