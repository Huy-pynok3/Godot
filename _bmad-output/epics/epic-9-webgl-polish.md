---
epic: 9
title: "WebGL Export & Performance Polish"
status: "ready"
priority: "medium"
depends_on: [8]
---

# Epic 9: WebGL Export & Performance Polish

## Mục tiêu

Đảm bảo game chạy mượt trên trình duyệt: optimize WebGL export, test MetaMask trên HTTPS, verify performance với 15 heroes đồng thời, và handle các edge cases của browser environment. Đây là boss fight cuối trước khi ship.

## Định nghĩa Hoàn thành (Definition of Done)

- [ ] HTML5 export build được không error
- [ ] MetaMask connect hoạt động trên Chrome (HTTPS)
- [ ] 15 heroes chạy đồng thời tại 60 FPS trên máy mid-range
- [ ] Không có Thread/raw socket calls trong HTML5 build
- [ ] Memory usage ổn định (không tăng vô hạn theo thời gian)

## User Stories

### ST-9.1 — HTML5 Export Configuration
**As a** developer,
**I want** Godot export preset HTML5 cấu hình đúng,
**So that** build ra file có thể serve trên web server.

**Acceptance Criteria:**
- Export preset "HTML5" với **Compatibility renderer**
- `project.godot` không có `"Forward Plus"` trong features khi export HTML5
- Export không có warning về threading hay unsupported features
- Output: `index.html`, `index.js`, `index.wasm`, `index.pck`
- Serve được trên localhost với Python `http.server` hoặc nginx

### ST-9.2 — MetaMask Integration Test (HTTPS)
**As a** player,
**I want** MetaMask hoạt động khi game được serve qua HTTPS,
**So that** có thể connect ví thật trên browser.

**Acceptance Criteria:**
- Test trên `https://localhost` (với self-signed cert) hoặc staging server
- `ethereum` object inject được từ MetaMask extension
- Wallet connect flow hoàn chỉnh: click → MetaMask popup → approve → address nhận được
- BSC network được detect đúng (chain ID 56)
- Error handling khi user reject MetaMask popup (không crash)

### ST-9.3 — Performance Benchmark: 15 Heroes
**As a** player,
**I want** game chạy mượt với 15 heroes đang hunt cùng lúc,
**So that** không bị lag hay giật trong quá trình chơi.

**Acceptance Criteria:**
- 15 heroes với staggered timers chạy liên tục trong 5 phút — không FPS drop dưới 50
- Profiler: không có GDScript function nào chiếm > 2ms/frame trong idle loop
- Không có memory leak (memory ổn định sau 10 phút chạy)
- WebSocket messages: không tắc nghẽn khi nhận nhiều confirmations cùng lúc

### ST-9.4 — Browser Edge Cases
**As a** game,
**I want** handle đúng các tình huống browser đặc thù,
**So that** không có silent crash hay broken state.

**Acceptance Criteria:**
- Tab ẩn (browser throttle timers): timers vẫn correct khi tab active lại
- Trang bị refresh giữa chừng: wallet phải connect lại, NFT cache load từ disk
- MetaMask locked khi đang play: emit `wallet_error`, về Lobby, hướng dẫn unlock
- Mạng mất giữa hunt: auto-reconnect flow hoạt động đúng
- `user://` storage hoạt động đúng trên Chrome (IndexedDB backend)

### ST-9.5 — Audio & Visuals Polish
**As a** player,
**I want** game có âm thanh và visual effect cơ bản,
**So that** gameplay cảm thấy có phản hồi và thú vị.

**Acceptance Criteria:**
- SFX: bomb explosion, chest destroy, BCOIN earn, hero spawn
- Background music (loop)
- Volume controls hoạt động từ settings
- Sprite animations cho hero idle/walk (có thể placeholder)
- Particle effect nhỏ khi BCOIN earned
