---
epic: 2
title: "Web3 & MetaMask Integration"
status: "ready"
priority: "critical"
depends_on: [1]
---

# Epic 2: Web3 & MetaMask Integration

## Mục tiêu

Implement toàn bộ pipeline Web3: kết nối MetaMask, đọc địa chỉ ví BSC, fetch NFT metadata từ BSC RPC, parse thành `HeroData`, và cache xuống disk. Đây là save point quan trọng nhất — không có epic này, game không thể biết user có hero nào.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] User có thể click "Connect Wallet" → MetaMask popup → approve → địa chỉ ví hiển thị trong game
- [ ] Game fetch danh sách NFT hero token IDs từ BSC RPC
- [ ] Mỗi hero token được parse thành `HeroData` với đủ 5 stats (Power, Speed, Stamina, Range, BombCount)
- [ ] Dữ liệu hero được cache vào `user://nft_cache.json` với TTL 1 giờ
- [ ] Trên PC build, `Web3Manager` no-op gracefully (không crash, không gọi JavaScriptBridge)
- [ ] Tất cả JS callbacks được store là member variables (không bị GC)

## User Stories

### ST-2.1 — MetaMask Bridge Utilities
**As a** developer,
**I want** `metamask_bridge.gd` build JS eval strings,
**So that** `Web3Manager` không cần biết JS syntax.

**Acceptance Criteria:**
- `MetaMaskBridge.build_connect_request(callback)` → trả về JS string gọi `ethereum.request({method: 'eth_requestAccounts'})`
- `MetaMaskBridge.build_metadata_request(token_id, callback)` → trả về JS string gọi BSC RPC `eth_call`
- Không file nào khác import `metamask_bridge.gd` ngoài `Web3Manager`
- Có `OS.has_feature("web")` guard trong mọi method

### ST-2.2 — Wallet Connect Flow
**As a** player,
**I want** click "Connect Wallet" và MetaMask popup xuất hiện,
**So that** tôi có thể xác thực ví BSC của mình.

**Acceptance Criteria:**
- Button "Connect Wallet" ở Lobby UI
- Gọi `Web3Manager.connect_wallet()` — chỉ từ button press (user gesture)
- `_wallet_callback` là **member variable** của `Web3Manager` (không phải local var)
- Thành công → emit `wallet_connected(address: String)` → `GameState.wallet_address` được set
- Thất bại → emit `wallet_error(message: String)` → hiển thị error message trong UI
- Trên PC: button disable hoặc hiện thông báo "Web3 not available"

### ST-2.3 — HeroData Resource
**As a** developer,
**I want** `HeroData` Resource class với 5 stats và derived methods,
**So that** mọi hệ thống đọc stats hero qua một interface thống nhất.

**Acceptance Criteria:**
- `class_name HeroData extends Resource`
- Fields: `token_id: int`, `power: int`, `speed: int`, `stamina: int`, `range: int`, `bomb_count: int`
- `get_move_interval() -> float` = `Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)`
- `get_max_bombs() -> int` = `bomb_count`
- `static func from_dict(data: Dictionary) -> HeroData` — clamp tất cả values về valid range
- Mỗi hero instance có **HeroData riêng** — không share giữa 2 heroes

### ST-2.4 — NFT Metadata Fetch
**As a** game,
**I want** fetch stats của từng NFT hero từ BSC RPC,
**So that** hero AI có thể sử dụng đúng stats on-chain.

**Acceptance Criteria:**
- `Web3Manager.fetch_nft_metadata(token_id: int)` — stagger requests (không gọi tất cả cùng lúc)
- `_metadata_callback` là **member variable** (không bị GC)
- Khi callback trả về: parse → tạo `HeroData` → emit `nft_metadata_received(token_id, stats)`
- BSC RPC rate limit: delay tối thiểu 200ms giữa mỗi request
- Nếu fetch thất bại: log WARN, emit `wallet_error`, không crash

### ST-2.5 — NFT Cache (Disk, TTL 1 giờ)
**As a** player,
**I want** game load nhanh khi mở lại trong vòng 1 giờ,
**So that** không phải chờ BSC RPC mỗi lần refresh.

**Acceptance Criteria:**
- `NFTCache.get_hero_stats(token_id) -> HeroData` — trả về cached data nếu còn valid, `null` nếu stale/missing
- `NFTCache.store(token_id, stats: HeroData)` — ghi vào `user://nft_cache.json` với timestamp
- TTL = `Balance.NFT_CACHE_TTL_SECONDS` (3600s)
- Cache format: `{ "token_id": { "power": 5, ..., "cached_at_unix": 1234567890 } }`
- `schema_version` field trong JSON cho future migration
- Chỉ `NFTCache` đọc/ghi file này — không file nào khác
