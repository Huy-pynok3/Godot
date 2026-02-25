# BombCrypto NFT (Godot + NestJS)

Dự án game BombCrypto-style gồm:
- **Client:** Godot 4.x (`/client`)
- **Backend:** NestJS + Prisma + Redis + PostgreSQL (`/backend`)

> Trạng thái hiện tại: đang trong giai đoạn phát triển MVP (khung kiến trúc đã có, gameplay loop chưa hoàn thiện end-to-end).

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

- Đã có khung: logging, game state, web3 manager, server api, grid/chest logic.
- Chưa hoàn thiện: hero runtime (`hero.gd`), flow chuyển phase lobby -> treasure hunt, spawn hero từ NFT metadata.
- Network config chain/contract vẫn còn placeholder, cần thay bằng thông tin thật.

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

## 10) Roadmap ngắn (đề xuất)

1. Hoàn thiện hero lifecycle và spawn pipeline
2. Chốt chuẩn protocol realtime (Socket.IO vs raw WS)
3. Hoàn thiện auth session + anti-cheat server validation
4. Kết nối metadata NFT thực (contract + ABI selector đúng)
5. Bổ sung docs deploy (staging/production)

---

## License

Tạm thời theo cấu hình hiện tại của repo (chưa khai báo chính thức ở root). Nếu public project, nên bổ sung LICENSE rõ ràng.
