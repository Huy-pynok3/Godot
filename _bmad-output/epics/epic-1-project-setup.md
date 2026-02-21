---
epic: 1
title: "Core Project Setup & Boilerplate"
status: "ready"
priority: "critical"
depends_on: []
---

# Epic 1: Core Project Setup & Boilerplate

## Mục tiêu

Thiết lập toàn bộ nền tảng dự án Godot 4.6 theo đúng cấu trúc đã định nghĩa trong architecture. Kết thúc epic này, dự án phải chạy được (màn hình đen hoặc placeholder), tất cả autoloads đã đăng ký, config files đã có giá trị mặc định, và DebugPanel hoạt động.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] Cấu trúc thư mục đúng theo architecture (`autoloads/`, `config/`, `scenes/`, `src/`, `assets/`, `debug/`)
- [ ] 5 autoloads đã stub và đăng ký trong Project Settings: `AppLogger`, `GameState`, `Web3Manager`, `ServerAPI`, `NFTCache`
- [ ] 3 config files có giá trị mặc định: `constants.gd`, `balance.gd`, `network.gd`
- [ ] `main.tscn` là main scene, chạy được không crash
- [ ] `DebugPanel` hiển thị khi chạy debug build (F1 toggle)
- [ ] Renderer đã đổi sang **Compatibility** (bắt buộc cho WebGL export)
- [ ] `AppLogger` hoạt động: `AppLogger.info("Main", "Game started")` in ra console đúng format

## User Stories

### ST-1.1 — Tạo cấu trúc thư mục
**As a** developer,
**I want** cấu trúc thư mục theo đúng architecture,
**So that** mọi AI agent đều biết đặt file mới ở đâu.

**Acceptance Criteria:**
- Tạo đầy đủ các thư mục: `autoloads/`, `config/`, `scenes/lobby/`, `scenes/treasure_hunt/`, `scenes/rest/`, `src/core/`, `src/hero/`, `src/map/`, `src/bomb/`, `src/ui/`, `src/web3/`, `assets/sprites/`, `assets/audio/`, `assets/ui/`, `debug/`
- Không có thư mục nào thiếu so với architecture

### ST-1.2 — AppLogger Autoload
**As a** developer,
**I want** một `AppLogger` autoload chuẩn hoá việc logging,
**So that** không có `print()` nào nằm rải rác trong codebase.

**Acceptance Criteria:**
- `AppLogger.info(system, msg, data)` — chỉ print khi `OS.is_debug_build()`
- `AppLogger.warn(system, msg, data)` — luôn `push_warning()`
- `AppLogger.error(system, msg, data)` — luôn `push_error()`
- Format: `[LEVEL] [System] Message — {data}`
- Không file nào khác được gọi `print()` trực tiếp

### ST-1.3 — Config Classes
**As a** developer,
**I want** 3 static config classes với các giá trị mặc định,
**So that** không có magic number nào trong game code.

**Acceptance Criteria:**
- `constants.gd`: `GRID_SIZE := Vector2i(20, 15)`, `MAX_HEROES := 15`, `BOMB_RADIUS := 1`
- `balance.gd`: `SPEED_BASE_INTERVAL := 2.0`, `SPEED_STEP := 0.1`, `STAMINA_DRAIN_PER_TICK := 1.0`, `NFT_CACHE_TTL_SECONDS := 3600`
- `network.gd`: `API_BASE_URL`, `WS_URL`, `BSC_RPC_URL` (placeholder strings cho dev)
- Tất cả dùng `class_name` và `const` — không instantiate

### ST-1.4 — Stub 5 Autoloads
**As a** developer,
**I want** 5 autoloads được stub với signals đã khai báo,
**So that** các epic sau có thể connect signals mà không bị lỗi.

**Acceptance Criteria:**
- `GameState`: có `var wallet_address: String`, `var active_hero_ids: Array[int]`, `var bcoin_balance: float`
- `Web3Manager`: khai báo signals `wallet_connected`, `wallet_error`, `nft_metadata_received`, `transaction_confirmed`
- `ServerAPI`: khai báo signals `bomb_validated`, `stamina_updated`, `reward_received`, `hero_move_confirmed`, `hero_move_rejected`, `connection_lost`
- `NFTCache`: có method stub `get_hero_stats(token_id: int) -> HeroData` trả về `null`
- Tất cả 5 autoloads đăng ký trong `Project Settings > Autoload`

### ST-1.5 — Main Scene & Game Phase FSM Skeleton
**As a** player,
**I want** game khởi động và hiển thị màn hình Lobby placeholder,
**So that** có thể verify build hoạt động end-to-end.

**Acceptance Criteria:**
- `main.tscn` là main scene
- `GamePhaseStateMachine` có 3 states: `LOBBY`, `TREASURE_HUNT`, `REST`
- Khởi động vào state `LOBBY`
- Không crash khi chạy trong editor và HTML5 export

### ST-1.6 — DebugPanel
**As a** developer,
**I want** DebugPanel chỉ load trong debug builds,
**So that** release build không có debug UI.

**Acceptance Criteria:**
- `debug/debug_panel.tscn` tồn tại với Label placeholder
- Chỉ được `add_child()` khi `OS.is_debug_build() == true`
- F1 toggle show/hide panel
- F2 print `GameState` dump ra console
