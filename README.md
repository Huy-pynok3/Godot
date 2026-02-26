# BombCrypto NFT (Godot + NestJS)

Dự án game BombCrypto-style Play-to-Earn NFT gồm:
- **Client:** Godot 4.x (`/client`)
- **Backend:** NestJS + Prisma + Redis + PostgreSQL (`/backend`)

> **Trạng thái hiện tại:** ~35% hoàn thiện - Core mechanics đã có, đang triển khai gameplay loop và multi-hero system.

## 🎮 Screenshots & Game Modes

### Game Lobby - Mode Selection
![BombCrypto Lobby](assets/screenshots/bombcrypto-lobby.png)

**3 Game Modes:**
1. **ADVENTURE** (Coming Soon) - Story mode với levels
2. **TREASURE HUNT** - Main P2E mode, farm BCOIN
3. **BATTLE** (Coming Soon) - PvP mode

**Bottom Menu:**
- 🎁 **CHEST** - Mở chest để nhận heroes
- 🏪 **SHOP** - Mua heroes và houses
- 🏠 **HOUSE** - Tăng stamina recovery speed
- 👥 **HEROES** - Quản lý hero collection

---

### Shop System
![BombCrypto Shop](assets/screenshots/bombcrypto-shop.webp)

**Shop Features:**
- **+10 Heroes Pack** - Mua 10 heroes random (gacha system)
- **Buy House** - Mua nhà để tăng rest speed
- **BUY Button** - Mua bằng BCOIN
- **×10 Option** - Mua bulk với discount

**House NFT Benefits:**
- Tăng stamina recovery rate
- Passive income boost
- Multiple houses = faster recovery

---

### Treasure Hunt Gameplay (Animated)
![BombCrypto Gameplay GIF](https://dappradar.com/blog/static/0d20b61b169c47af059ebc4f23a066bd/dappradar.com-play-to-earn-bomb-crypto-becomes-top-3-game-0-kqgfp6vxn89vdypl.gif)

**Gameplay Mechanics từ GIF:**
- Multiple heroes di chuyển đồng thời
- Bombs đặt và nổ theo cross pattern
- Chests bị phá → BCOIN drops
- Heroes auto-collect coins
- Real-time multiplayer action

---

### Treasure Hunt Mode (Static)
![BombCrypto Treasure Hunt](assets/screenshots/bombcrypto-gameplay.png)

**Map Analysis:**
- **Grid:** 20x15 tiles
- **Pattern:** Checkerboard (brown chests + white walls)
- **Heroes:** 6-8 heroes visible (max 15)
- **Objects:** Bombs, explosions, BCOIN drops
- **UI:** BCOIN counter (ví dụ 30.94), BCOIN label, icons (không phải timer)

---

## 📊 Độ hoàn thiện so với BombCrypto 2021

| Tính năng | Trạng thái | Ghi chú |
|-----------|-----------|---------|
| **Core Gameplay** |
| ✅ Hero NFT System | 50% | Stats, stamina, energy drain đã có |
| ✅ Bomb Mechanics | 40% | Placement, explosion, cross-pattern |
| ✅ Chest System | 60% | HP, damage, destroy logic |
| ✅ Grid Map 20x15 | 80% | Grid logic, collision detection |
| ✅ WebSocket Real-time | 60% | Move, bomb intents validated |
| ✅ Auth + JWT | 80% | Wallet login, nonce verification |
| **Game Modes** |
| ✅ Treasure Hunt | 40% | Core logic có, chưa hoàn chỉnh |
| ❌ Adventure Mode | 0% | Story mode chưa có |
| ❌ Battle Mode | 0% | PvP chưa có |
| **Features** |
| ❌ Fixed Walls (Checkerboard) | 0% | Chưa có pattern cố định |
| ❌ BCOIN Drop + Collect | 0% | Chưa có drop animation + auto-collect |
| ❌ Multi-hero (15 heroes) | 0% | Chưa spawn nhiều hero cùng lúc |
| ❌ Map Progression (Clear All Chests) | 0% | Chưa có logic chuyển map khi phá hết rương |
| ❌ Hero Skins/Colors | 0% | Chưa có visual differentiation |
| ❌ AI Auto-play | 0% | Chưa có pathfinding |
| ❌ Chain Reaction | 0% | Bomb chưa kích bomb khác |
| **Economy & NFT** |
| ❌ Shop System | 0% | Chưa có buy heroes/houses |
| ❌ Chest Opening | 0% | Chưa có gacha system |
| ❌ House NFT | 0% | Chưa có rest speed boost |
| ❌ Hero Management UI | 0% | Chưa có inventory screen |
| ❌ NFT Contract Integration | 10% | Placeholder contract address |

### Phát hiện mới từ ảnh:
🔍 **Lobby System:** 3 game modes (Adventure, Treasure Hunt, Battle)
🔍 **Shop System:** Buy heroes pack (×10), buy houses
🔍 **Bottom Menu:** Chest, Shop, House, Heroes navigation
🔍 **Map Pattern:** Checkerboard với fixed walls xen kẽ chests
🔍 **Multiple Heroes:** 6-8 heroes khác màu trên map
🔍 **BCOIN Drops:** Coins màu vàng rơi tại vị trí chest destroyed
🔍 **Explosion Visual:** Màu đỏ/cam, rõ ràng cross pattern
🔍 **UI Top Bar:** BCOIN counter, House icon, Settings (không có map timer)

## 🎮 Gameplay Mechanics (theo BombCrypto 2021)

### Treasure Hunt Mode
- **Grid:** 20x15 tiles với mê cung blocks
- **Heroes:** Tối đa 15 bomber heroes NFT cùng lúc
- **Objective:** Phá rương (chests) để kiếm BCOIN
- **Energy:** Mỗi action (move/bomb) tiêu hao stamina
- **Rest:** Hero tự động nghỉ khi hết stamina

### Core Loop
1. Spawn 15 heroes từ NFT collection
2. Heroes tự động di chuyển (AI) hoặc manual control
3. Đặt bomb để phá chests (1-3 HP)
4. Collect BCOIN rơi ra
5. Stamina drain → Rest → Repeat
6. Phá hết rương trong map → chuyển sang map mới

### Game Map Layout (từ BombCrypto 2021)
```
┌──────────────────────────────────────────────────────────────────┐
│ 💰 30.94    BCOIN    🏠 House    ⚙️ Settings                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🟩 🟫 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩    │
│  🟫 🟩 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 � 🟩 🟫 🟩 � 🟩 � 🟩 �    │
│  � 🟩 🤖 � 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫    │
│  🟩 🟫 🟫 🟩 🟫 🟩 🟫 💣 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩    │
│  🟫 🟩 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 � 🟫 � 🟫 � 🟫 � 🟫 🟩 🟫    │
│  🟫 🟩 🤖 🟫 � 🟫 � 🟫 � 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫    │
│  🟩 🟫 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩    │
│  🟫 🟩 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫    │
│  🟫 � 🤖 🟫 � 🟫 � 🟫 🔥 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫    │
│  🟩 🟫 � 🟩 � 🟩 � 🟩 � 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩 🟫 🟩    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

Phân tích từ ảnh thực tế:
┌─────────────────────────────────────────────────────────────────┐
│ OBJECTS TRÊN MAP:                                               │
├─────────────────────────────────────────────────────────────────┤
│ 🟫 Brown Blocks (Chests)  - Có thể phá, drop BCOIN             │
│ 🟩 White/Gray Blocks      - Fixed walls, KHÔNG phá được        │
│ 🤖 Heroes (nhiều màu)     - Purple, Blue, Green, Yellow, Red   │
│ 💣 Bombs                  - Màu vàng/cam, có timer             │
│ 🔥 Explosions             - Màu đỏ/cam, cross pattern          │
│ 💰 BCOIN Drops            - Màu vàng, rơi từ chests phá hủy    │
│ 🟢 Green Background       - Walkable tiles                     │
└─────────────────────────────────────────────────────────────────┘

PATTERN QUAN TRỌNG:
- Map có CHECKERBOARD pattern: Brown/White xen kẽ
- Fixed walls (white) tạo mê cung cố định
- Chests (brown) spawn random trên các ô cố định
- Heroes có thể đi qua ô xanh và ô có BCOIN
- Bombs đặt tại vị trí hero đứng
- Explosion lan theo cross pattern (+)
```

### Các loại Objects chi tiết

**1. Fixed Walls (White/Gray blocks):**
- Không thể phá hủy
- Tạo pattern cố định theo checkerboard
- Block movement và explosion
- Vị trí: Các ô chẵn/lẻ theo pattern

**2. Chests (Brown blocks):**
- HP: 1-3 (random)
- Drop: 8-12 BCOIN (tùy HP)
- Có thể phá bằng bomb
- Respawn: Không (trong 1 map)
- Vị trí: Random trên các ô không có fixed wall

**3. Heroes (Colored bombers):**
- Màu sắc: Purple, Blue, Green, Yellow, Red, Pink
- Mỗi hero có stats riêng (NFT)
- Có stamina bar (không thấy trong ảnh nhưng có trong game)
- Di chuyển: 4 directions (up/down/left/right)
- Max: 15 heroes cùng lúc

**4. Bombs:**
- Timer: 3 seconds
- Visual: Màu vàng/cam với số đếm ngược
- Explosion: Cross pattern theo bomb_range stat
- Chain reaction: Có thể kích bomb khác

**5. BCOIN Drops:**
- Màu vàng sáng
- Auto-collect khi hero đi qua
- Lifetime: ~5 seconds trước khi biến mất
- Value: Hiển thị số trên UI top bar

---

## 🏗️ Kiến trúc hệ thống

```mermaid
graph TB
    subgraph "Client (Godot 4.x)"
        UI[UI Layer]
        Game[Game Logic]
        Web3[Web3Manager]
        WS[WebSocket Client]
    end
    
    subgraph "Backend (NestJS)"
        Gateway[WebSocket Gateway]
        Auth[Auth Service]
        Treasure[Treasure Service]
        Grid[Grid Service]
        Hero[Hero Service]
    end
    
    subgraph "Storage"
        Postgres[(PostgreSQL)]
        Redis[(Redis Cache)]
    end
    
    subgraph "Blockchain"
        BSC[Binance Smart Chain]
        Contract[NFT Contract]
    end
    
    UI --> Game
    Game --> WS
    Game --> Web3
    Web3 --> BSC
    BSC --> Contract
    WS --> Gateway
    Gateway --> Auth
    Gateway --> Treasure
    Gateway --> Grid
    Gateway --> Hero
    Treasure --> Postgres
    Grid --> Redis
    Hero --> Postgres
    Auth --> Postgres
```

### Flow: Hero Move Action
```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Grid
    participant Redis
    
    Client->>Gateway: move_intent(hero_id, x, y)
    Gateway->>Gateway: Acquire lock
    Gateway->>Grid: validateMove(userId, tokenId, x, y)
    Grid->>Redis: Get hero position
    Redis-->>Grid: Current position
    Grid->>Redis: Get grid state
    Redis-->>Grid: Chest locations
    Grid->>Grid: Check bounds, adjacency, obstacles
    Grid-->>Gateway: Validation result
    alt Valid move
        Gateway->>Redis: Update hero position
        Gateway->>Client: hero_move_confirmed
    else Invalid move
        Gateway->>Client: hero_move_rejected(reason)
    end
    Gateway->>Gateway: Release lock
```

### Flow: Bomb Explosion
```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Grid
    participant Hero
    participant Redis
    
    Client->>Gateway: bomb_intent(hero_id, x, y)
    Gateway->>Hero: Check stamina
    Hero-->>Gateway: Sufficient
    Gateway->>Hero: Drain stamina
    Gateway->>Client: bomb_validated
    
    Note over Client: 3 second timer
    
    Client->>Client: Bomb explodes
    Gateway->>Grid: Calculate cross pattern
    loop For each affected cell
        Grid->>Redis: hitChest(x, y)
        alt Chest destroyed
            Redis-->>Grid: destroyed=true
            Grid->>Gateway: Chest destroyed
            Gateway->>Client: chest_destroyed(x, y, bcoin)
        else Chest damaged
            Redis-->>Grid: destroyed=false
            Gateway->>Client: chest_hit(x, y)
        end
    end
```

---

## 1) Cấu trúc thư mục

```text
Godot/
├─ client/                 # Godot game client
│  ├─ autoloads/          # Global singletons (Web3Manager, ServerAPI, ...)
│  ├─ scenes/             # Main, Lobby, TreasureHunt scenes
│  ├─ src/                # Core, map, ui, hero, web3 scripts
│  └─ project.godot
│
├─ backend/               # NestJS backend
│  ├─ src/
│  │  ├─ auth/            # Nonce + wallet login + JWT
│  │  ├─ game/            # WebSocket gateway cho gameplay intents
│  │  ├─ prisma/
│  │  └─ redis/
│  ├─ prisma/schema.prisma
│  └─ package.json
│
└─ docker-compose.dev.yml # Postgres + Redis + Backend local
```

---

## 2) Yêu cầu môi trường

- **Godot 4.6** (khuyến nghị đúng version trong `client/project.godot`)
- **Node.js 20+**
- **Docker + Docker Compose**

---

## 3) Chạy nhanh bằng Docker (backend stack)

Tại thư mục gốc `Godot/`:

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Kiểm tra health:

```bash
curl http://localhost:3000/health
# Kỳ vọng: OK
```

Dừng:

```bash
docker compose -f docker-compose.dev.yml down
```

---

## 4) Chạy backend thủ công (không Docker)

```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init
npm run start:dev
```

Biến môi trường cơ bản (`backend/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/bombcrypto?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="replace_me"
PORT=3000
```

---

## 5) Chạy client Godot

1. Mở Godot Editor
2. Import project tại `client/project.godot`
3. Run scene chính: `res://scenes/main.tscn`

Cấu hình network client nằm ở:
- `client/config/network.gd`

Mặc định local:
- API: `http://localhost:3000`
- WS: `ws://localhost:3000/ws`

---

## 6) API / Auth flow hiện có

### REST
- `GET /health` -> `OK`
- `POST /auth/nonce`
- `POST /auth/wallet-login`

### WebSocket (backend)
- Gateway namespace: `/game`
- Events đang có: `move_intent`, `bomb_intent`, `heartbeat`
- Phản hồi mẫu: `hero_move_confirmed`, `bomb_validated`

---

## 7) Lưu ý quan trọng khi tích hợp client <-> backend

Hiện tại backend dùng **Socket.IO Gateway** (`namespace: /game`), trong khi client đang dùng `WebSocketPeer` raw WS.

Điều này có thể gây **không tương thích protocol** nếu chưa có bridge/adapter.

Gợi ý 2 hướng:
1. Đổi client sang Socket.IO-compatible layer, hoặc
2. Đổi backend sang WebSocket thuần để khớp `WebSocketPeer`.

---

## 8) Tình trạng dev hiện tại (snapshot)

### ✅ Đã triển khai:
- **Architecture:** NestJS + Godot + Docker stack
- **Auth:** Wallet login với nonce + signature verification
- **Hero System:** 
  - Stats: power, speed, stamina, bomb_range, bomb_count
  - Stamina drain per action (move/bomb)
  - Auto-rest when depleted
  - `hero.gd` với full lifecycle logic
- **Bomb System:**
  - Placement với stamina check
  - 3-second timer
  - Cross-pattern explosion (4 directions)
  - `bomb.gd` với explosion logic
- **Chest System:**
  - HP-based damage (1-3 HP)
  - BCOIN value calculation
  - Destroy animation
  - `chest.gd` với damage/destroy logic
- **Grid Service:**
  - Move validation (bounds, obstacles, adjacency)
  - Chest hit detection
  - Redis caching
- **WebSocket Gateway:**
  - `move_intent` với server validation
  - `bomb_intent` với explosion + chest damage
  - JWT authentication
  - Redis lock để prevent race conditions

### ❌ Chưa hoàn thiện:
- **Multi-hero spawning:** Chỉ có logic 1 hero, chưa spawn 15 heroes
- **BCOIN collection:** Chest drop BCOIN nhưng chưa có auto-collect
- **Map progression:** Backend có TreasureSession nhưng chưa có logic clear-all-chests -> map mới
- **Map obstacles:** Chưa có fixed walls và destructible blocks
- **AI pathfinding:** Chưa có auto-play mode
- **NFT metadata:** Contract address vẫn là placeholder
- **UI/Visual:** Chỉ có placeholder sprites
- **Protocol sync:** Backend dùng Socket.IO, client dùng WebSocketPeer raw

---

## 9) Scripts hữu ích

Trong `backend/package.json`:

```bash
npm run start:dev
npm run build
npm run test
npm run test:e2e
npm run lint
```

---

## 10) Roadmap triển khai

### Phase 1: Core Gameplay Loop (Ưu tiên cao)
- [ ] BCOIN drop + auto-collection system
- [ ] Multiple heroes spawning (15 heroes)
- [ ] Clear-all-chests detection + auto-load next map
- [ ] Hero manager (quản lý nhiều heroes)
- [ ] Balance update real-time

### Phase 2: Map & Obstacles (QUAN TRỌNG - từ ảnh thực tế)
- [ ] **Checkerboard pattern generation** (fixed walls xen kẽ chests)
- [ ] Fixed walls (white/gray blocks) - KHÔNG phá được, block movement
- [ ] Chests (brown blocks) - spawn random, có thể phá
- [ ] Collision detection với fixed walls
- [ ] Map layout theo pattern BombCrypto gốc (20x15 grid)

### Phase 3: Visual & Animation (Cần cho UX)
- [ ] Hero sprites với nhiều màu (purple, blue, green, yellow, red, pink)
- [ ] Bomb sprite + countdown timer visual (3, 2, 1)
- [ ] Explosion animation (cross pattern, màu đỏ/cam)
- [ ] BCOIN drop animation (coin rơi xuống + sparkle)
- [ ] Chest destruction effect (fade out)
- [ ] Stamina bar UI cho mỗi hero (trên đầu hero)
- [ ] Top bar UI (BCOIN counter, house icon, settings)

### Phase 4: Lobby & Navigation
- [ ] **Lobby screen** với 3 mode cards (Adventure, Treasure Hunt, Battle)
- [ ] Mode selection UI
- [ ] Bottom navigation menu (Chest, Shop, House, Heroes)
- [ ] Scene transitions
- [ ] Coming Soon placeholders cho Adventure/Battle

### Phase 5: Shop System
- [ ] **Shop UI** - Buy heroes pack (×1, ×10)
- [ ] **Buy House UI** - Purchase house NFT
- [ ] Hero gacha system (random stats)
- [ ] Chest opening animation
- [ ] BCOIN pricing system
- [ ] Transaction confirmation dialogs

### Phase 6: Hero Management
- [ ] **Heroes screen** - View all owned heroes
- [ ] Hero inventory grid
- [ ] Hero details popup (stats, level, rarity)
- [ ] Select heroes for battle (max 15)
- [ ] Hero sorting/filtering
- [ ] Sell/transfer heroes

### Phase 7: House System
- [ ] **House NFT** - Stamina recovery boost
- [ ] Multiple houses support
- [ ] House upgrade system
- [ ] Visual house display
- [ ] Passive income calculation

### Phase 8: Advanced Mechanics
- [ ] Bomb chain reaction
- [ ] Power-ups (speed boost, bomb count, range)
- [ ] Hero AI/Auto-play mode
- [ ] Pathfinding algorithm (A*)

### Phase 9: Real-time Sync & Anti-cheat
- [ ] Broadcast hero positions to all clients
- [ ] Sync bomb explosions
- [ ] Sync chest destruction
- [ ] Server-side validation tất cả actions
- [ ] Chốt protocol (Socket.IO hoặc raw WS)

### Phase 10: NFT Integration
- [ ] Deploy/connect smart contract thực
- [ ] Fetch hero metadata from chain
- [ ] Claim BCOIN to wallet với signature
- [ ] Hero marketplace integration

### Phase 11: Polish & Optimization
- [ ] Sound effects (bomb, explosion, coin collect)
- [ ] Background music
- [ ] Particle effects
- [ ] Performance optimization (object pooling)
- [ ] Mobile responsive (nếu cần)

---

## 11) Files quan trọng đã triển khai

### Client (Godot)
```
client/
├── scenes/treasure_hunt/
│   ├── hero.gd              # Hero lifecycle, stamina, move/bomb logic
│   ├── chest.tscn           # Chest scene với HP system
│   └── treasure_hunt.tscn   # Main game scene
├── src/
│   ├── bomb/
│   │   ├── bomb.gd          # Bomb timer, explosion, cross-pattern
│   │   └── bomb.tscn
│   ├── map/
│   │   └── chest.gd         # Chest damage, destroy, BCOIN value
│   └── hero/
│       └── hero_data.gd     # Hero stats data structure
├── autoloads/
│   ├── game_state.gd        # Global state (wallet, heroes, balance)
│   ├── web3_manager.gd      # MetaMask integration
│   └── server_api.gd        # WebSocket client
└── config/
    ├── constants.gd         # GRID_SIZE, MAX_HEROES, BOMB_RADIUS
    ├── balance.gd           # Game balance (stamina drain, speed)
    └── network.gd           # API URLs, contract address
```

### Backend (NestJS)
```
backend/
├── src/
│   ├── auth/
│   │   ├── auth.service.ts      # Nonce generation, signature verify
│   │   └── auth.controller.ts   # /auth/nonce, /auth/wallet-login
│   ├── game/
│   │   ├── game.gateway.ts      # WebSocket: move_intent, bomb_intent
│   │   └── dto/
│   │       ├── move-intent.dto.ts
│   │       └── bomb-intent.dto.ts
│   ├── treasure/
│   │   ├── treasure.service.ts  # Start/stop session, grid generation
│   │   ├── grid.service.ts      # Move validation, chest hit detection
│   │   └── hero.service.ts      # Stamina management
│   └── prisma/
│       └── schema.prisma        # User, Hero, TreasureSession, RewardLedger
└── prisma/
    └── migrations/              # Database schema
```

---

## 12) Hero Stats & Mechanics

### Hero NFT Attributes
```
┌─────────────────────────────────────┐
│  Hero #1234                         │
│  ┌─────────┐                        │
│  │  🤖     │  Rarity: Common        │
│  │         │                        │
│  └─────────┘                        │
│                                     │
│  ⚡ Power:    5/10  (Bomb damage)  │
│  🏃 Speed:    7/10  (Move interval)│
│  💪 Stamina:  6/10  (Max energy)   │
│  💥 Range:    2/10  (Blast radius) │
│  💣 Bombs:    3/5   (Max bombs)    │
│                                     │
│  Current Stamina: ████████░░ 80%   │
│  Status: 🟢 Active                 │
└─────────────────────────────────────┘
```

### Stamina System
```
Max Stamina = Stamina Stat × 10
Example: Stamina 6 → Max 60 energy

Actions:
  - Move:  -1 stamina
  - Bomb:  -1 stamina

Rest Mode:
  - Triggers: Stamina = 0
  - Restore: +1 stamina/second
  - Resume: Stamina = Max
```

### Bomb Mechanics
```
Explosion Pattern (Range = 2):

        ░
        🔥
        🔥
  ░ 🔥 🔥 💣 🔥 🔥 ░
        🔥
        🔥
        ░

Timer: 3 seconds
Damage: 1 HP per hit
Chain: Bomb can trigger other bombs
```

---

## 13) So sánh với BombCrypto 2021

### Giống:
✅ Grid-based map 20x15  
✅ Hero NFT với stats (power, speed, stamina, range)  
✅ Bomb cross-pattern explosion  
✅ Chest với HP system  
✅ Stamina drain + rest mechanics  
✅ Play-to-Earn với BCOIN  
✅ Binance Smart Chain integration  

### Khác/Chưa có:
❌ Multi-hero (15 heroes) - chưa spawn nhiều  
❌ AI auto-play - chưa có pathfinding  
❌ Fixed walls/obstacles - chỉ có chest  
❌ Map progression clear-all-chests - chưa chuyển map tự động  
❌ House NFT - chưa có rest speed boost  
❌ Story Mode - chỉ có Treasure Hunt  
❌ Battle Mode - chưa có PvP  
❌ Marketplace - chưa trade heroes  

---

## 14) Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Godot 4.6 (GDScript)                            │  │
│  │  - Scene system                                  │  │
│  │  - Node2D for sprites                            │  │
│  │  - AnimationPlayer                               │  │
│  │  - JavaScriptBridge (Web3)                       │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕ WebSocket
┌─────────────────────────────────────────────────────────┐
│                     BACKEND                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │  NestJS (TypeScript)                             │  │
│  │  - WebSocket Gateway (Socket.IO)                 │  │
│  │  - REST API                                      │  │
│  │  - JWT Authentication                            │  │
│  │  - Validation Pipes                              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                     DATABASE                            │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ PostgreSQL   │         │    Redis     │            │
│  │ - Users      │         │ - Sessions   │            │
│  │ - Heroes     │         │ - Grid cache │            │
│  │ - Sessions   │         │ - Locks      │            │
│  │ - Rewards    │         │ - Positions  │            │
│  └──────────────┘         └──────────────┘            │
└─────────────────────────────────────────────────────────┘
                          ↕
┌─────────────────────────────────────────────────────────┐
│                    BLOCKCHAIN                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Binance Smart Chain (BSC)                       │  │
│  │  - Hero NFT Contract                             │  │
│  │  - BCOIN Token Contract                          │  │
│  │  - MetaMask Integration                          │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## License

