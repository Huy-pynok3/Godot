---
title: 'Game Architecture'
project: 'Godot'
date: '2026-02-21'
author: 'Admin'
version: '1.0'
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9]
status: 'complete'
engine: 'Godot 4.6'
platform: 'WebGL/HTML5, PC'

# Source Documents
gdd: null
epics: null
brief: null
---

# Game Architecture

## Executive Summary

BombCrypto Remake is a server-authoritative, blockchain-integrated idle game built in Godot 4.6 targeting WebGL/HTML5. The architecture isolates all Web3/MetaMask interaction behind a single `Web3Manager` autoload using Godot's `JavaScriptBridge`, communicates with a server-side validation backend via a hybrid REST + WebSocket protocol, and drives up to 15 concurrent AI heroes through NFT-parsed stats with staggered per-hero timers.

## Document Status

This architecture document is being created through the GDS Architecture Workflow.

**Steps Completed:** 9 of 9 (Complete ✅)

---

## Project Context

### Game Overview

**BombCrypto Remake** — 2D top-down idle game. Heroes auto-move on a grid, plant bombs to destroy treasure chests, earn BCOIN rewards. Core loop: Mint NFT Heroes → Treasure Hunt → Earn BCOIN → Rest/Recover Stamina.

### Technical Scope

**Platform:** WebGL/HTML5 (primary), PC (secondary)
**Genre:** Idle / Blockchain Game
**Engine:** Godot 4.x
**Project Level:** High Complexity

### Core Systems

| System | Complexity | Notes |
|---|---|---|
| Web3/MetaMask Integration | High | BSC wallet connect, tx signing, NFT minting |
| NFT Metadata Parser | Medium | 5 stats: Power, Speed, Stamina, Range, BombCount |
| Hero AI (Grid Movement) | Medium | Random grid-based pathfinding, bomb placement logic |
| Bomb/Explosion System | Medium | Server-authoritative hit validation |
| Stamina & Rest System | Medium | Server-tracked, client mirrors state only |
| Chest Spawning & Destruction | Medium | Server decides outcome, client animates |
| Reward/BCOIN Economy | High | Server-validated, smart contract payout |
| Server API Layer | High | REST or WebSocket, anti-cheat validation |
| UI/HUD | Low | Hero roster, stamina bars, earnings display |

### Technical Requirements

- WebGL/HTML5 export via Godot 4 (no threads, limited memory, no raw sockets)
- MetaMask integration via Godot 4 `JavaScriptBridge`
- Binance Smart Chain (BSC) wallet connect and transaction signing
- Server-authoritative backend: validates bomb hits, stamina, chest destruction, rewards
- Up to 15 concurrent AI-controlled heroes running simultaneously
- WebSocket preferred over raw TCP for browser compatibility

### Complexity Drivers

- **Web3 JS Bridge**: Async MetaMask calls through Godot's JavaScriptBridge — browser-specific, fragile
- **Server-Authoritative Idle Loop**: Every meaningful game event validated server-side with low-latency feel
- **NFT Stat Pipeline**: Fetch metadata from BSC RPC → parse 5 stats → drive hero behavior
- **Concurrent AI Tick System**: 15 independent hero AIs running grid movement + bomb logic each tick

### Technical Risks

1. JavaScript bridge reliability for MetaMask (async, browser-specific quirks)
2. Server round-trip latency affecting idle loop responsiveness
3. WebGL memory pressure with 15 animated heroes
4. BSC RPC rate limits during NFT metadata batch-fetching

## Engine & Framework

### Selected Engine

**Godot 4.6** (latest stable)

**Rationale:** Already decided by project. Native WebGL/HTML5 export, built-in JavaScriptBridge for MetaMask, WebSocketPeer for server comms, and GDScript for rapid iteration. Free and open-source with no royalties — important for a blockchain game economy.

### Project Initialization

Blank Godot 4.6 project — no starter template. Custom architecture required for the blockchain/server-authoritative idle loop.

### Engine-Provided Architecture

| Component | Solution | Notes |
|---|---|---|
| 2D Rendering | CanvasItem renderer | Hardware-accelerated, handles 15 hero sprites easily |
| Physics | Godot Physics 2D | Available but largely unused — movement is grid-based, not physics-driven |
| Audio | AudioServer | Built-in bus system |
| Input | InputMap | Action-based; minimal input (idle game) |
| Scene Management | SceneTree / Node system | Hierarchical scene composition |
| Scripting | GDScript | Primary language; fast iteration |
| Export | HTML5 + PC export presets | WebGL via Godot export templates |
| Networking | WebSocketPeer, HTTPClient | Browser-compatible; no raw TCP |
| JS Bridge | JavaScriptBridge | Built-in for Web export — critical for MetaMask |
| Timers / Coroutines | SceneTree.create_timer, await | Used for stamina ticks and AI intervals |

### Remaining Architectural Decisions

The following decisions must be made explicitly in Step 4:

1. Server communication protocol — REST vs WebSocket vs hybrid
2. Web3/MetaMask integration pattern — JS bridge call structure
3. NFT metadata fetch and caching strategy (BSC RPC)
4. Hero AI tick system — how 15 concurrent AIs are scheduled
5. Client/server state authority split — what the client owns vs server
6. Scene and node organization pattern
7. Data persistence — session state, token cache, local save data

### AI Tooling (MCP Servers)

**godot-mcp (bradypp)** — `https://github.com/bradypp/godot-mcp`
- Launch Godot Editor and run projects in debug mode from AI
- Generate, modify, and remove scenes and nodes directly
- Read console output and errors in real time
- Node.js only — no Godot plugin required
- Install: `git clone https://github.com/bradypp/godot-mcp.git && cd godot-mcp && npm install && npm run build`

**Context7 (upstash)** — `https://github.com/upstash/context7`
- Pulls current Godot 4.x API docs into AI prompts on demand
- Prevents outdated API usage (WebSocketPeer, JavaScriptBridge, etc.)
- Install: `claude mcp add context7 -- npx -y @upstash/context7-mcp`

## Architectural Decisions

### Decision Summary

| Category | Decision | Rationale |
|---|---|---|
| Server Protocol | Hybrid (REST + WebSocket) | REST for blockchain/wallet ops; WebSocket for live game loop |
| Web3 Integration | Web3Manager Singleton | Isolates JS bridge fragility; clean GDScript API for rest of game |
| NFT Metadata | Disk cache + TTL (1hr) | Fast startup; survives refresh; avoids BSC rate limits |
| Hero AI Ticking | Staggered timers per hero | Natural feel; Speed stat drives interval; randomized startup offset |
| State Authority | Client as dumb renderer | No client-side reward logic; server validates all meaningful events |
| State Management | Singletons + State Machine | GameState autoload for data; GamePhaseStateMachine for phase transitions |
| Data Persistence | JSON file (local) | NFT cache + UI preferences only; all game progress is server-authoritative |

### Server Communication

**Approach:** Hybrid — REST API + WebSocket

- **REST API:** Used for all blockchain/wallet operations — minting, claiming rewards, fetching wallet state. These are inherently async and slow; REST fits naturally.
- **WebSocket:** Persistent connection for the live game loop — stamina drain ticks, bomb placement validation, chest spawn/destroy events. Server can push updates without client polling.
- **Connection lifecycle:** WebSocket established on session start (after wallet auth), maintained throughout Treasure Hunt, closed on Rest phase or disconnect.

### Web3 / MetaMask Integration

**Approach:** Dedicated `Web3Manager` Autoload Singleton

All `JavaScriptBridge` calls are isolated in a single `Web3Manager` autoload. The rest of the game never calls `JavaScriptBridge` directly — it calls clean GDScript signals and methods on `Web3Manager`.

- Wallet connect, sign transactions, read BSC RPC → all go through `Web3Manager`
- Emits signals: `wallet_connected(address)`, `transaction_confirmed(tx_hash)`, `nft_metadata_received(hero_id, stats)`
- Handles async JS callbacks via `JavaScriptBridge.create_callback()`

### NFT Metadata Caching

**Approach:** Disk cache with 1-hour TTL

- On session start, check local JSON cache (`user://nft_cache.json`) for each hero token ID
- If cached entry exists and age < 1 hour → use cached stats
- If stale or missing → fetch from BSC RPC via `Web3Manager`
- Cache stores: `{ token_id, power, speed, stamina, blast_range, bomb_count, cached_at_unix }`
- Server re-validates NFT ownership on session auth — client cache is for speed, not authority

### Hero AI Tick System

**Approach:** Staggered individual timers per hero

- Each `HeroAI` node owns its own `Timer` node
- Timer interval = derived from hero's Speed stat (e.g., `2.0 - (speed * 0.1)` seconds)
- On hero spawn, timer start is offset by a random value (0–2s) to prevent synchronized movement
- On each tick: evaluate grid position → pick valid adjacent cell → request move → check for bomb placement opportunity → send bomb intent to server if applicable

### State Authority Split

**Rule: Client is a dumb renderer. Server is the single source of truth.**

| Game Element | Client Role | Server Role |
|---|---|---|
| Hero visual position | Animate freely on confirmed moves | Validate grid position; reject invalid moves |
| Stamina | Display server-pushed value | Authoritative; drains on tick, resets on Rest |
| Bomb placement | Send intent; animate on confirmation | Validate placement; calculate hit; determine chest outcome |
| Chest destruction | Animate on server confirmation | Decide destruction; calculate reward |
| BCOIN balance | Display server-pushed value | Authoritative; never trust client balance |
| NFT ownership | Read from cache for stats | Re-validate on session start; reject unowned heroes |

### State Management

**Approach:** Autoload Singletons + top-level State Machine

- **`GameState` (Autoload):** Holds session data — connected wallet, active heroes list, BCOIN display balance, current stamina values
- **`Web3Manager` (Autoload):** All JavaScript bridge and blockchain calls
- **`ServerAPI` (Autoload):** WebSocket connection + REST HTTP calls; exposes clean signal-based API
- **`NFTCache` (Autoload):** Reads/writes local JSON cache; exposes `get_hero_stats(token_id)`
- **`GamePhaseStateMachine` (Node in main scene):** Manages transitions between `Lobby`, `TreasureHunt`, and `Rest` phases

### Data Persistence

**Approach:** JSON file via `FileAccess` for local data only

- `user://nft_cache.json` — Hero NFT metadata cache with TTL timestamps
- `user://settings.json` — UI preferences (volume, display settings)
- **No local save for game progress** — stamina, BCOIN, hero status are server-authoritative
- Schema versioned with a `schema_version` field for future migration handling

## Cross-cutting Concerns

These patterns apply to **all systems** and must be followed by every AI agent implementation without exception.

### Error Handling

**Strategy:** Signal-based for recoverable errors + global handler for unhandled exceptions.

**Error Levels:**

| Level | When to Use | Action |
|---|---|---|
| ERROR | Unrecoverable — crash, auth failure, corrupt data | Log + notify player; drop to safe state |
| WARN | Recoverable but unexpected — server rejection, stale cache | Log + skip action |
| INFO | Normal milestones — hero spawned, phase changed, wallet connected | Log in debug builds |
| DEBUG | Diagnostic detail — AI tick result, WS message received | Log in debug builds only |

**Server Validation Failure Rule:** If the server rejects an action (bomb, move), the hero **skips that action silently** and logs at WARN level. No retry, no crash, no player notification — the idle loop continues.

**WebSocket Disconnect Rule:** On disconnect, `ServerAPI` automatically attempts reconnect up to **3 times** with exponential backoff (1s, 2s, 4s). If all 3 fail, emit `connection_lost` signal → `GamePhaseStateMachine` transitions to Lobby and shows reconnect UI.

**Example:**
```gdscript
# ServerAPI.gd
signal connection_lost()

func _attempt_reconnect() -> void:
    for attempt in range(3):
        await get_tree().create_timer(pow(2, attempt)).timeout
        if _connect_websocket():
            return
    AppLogger.error("ServerAPI", "WebSocket reconnect failed after 3 attempts")
    connection_lost.emit()
```

### Logging

**Format:** `[LEVEL] [System] Message — {key: value}`

**AppLogger Autoload** wraps Godot's native print/push_error:

```gdscript
# AppLogger.gd (Autoload)
# Usage: AppLogger.warn("HeroAI", "Move rejected", {hero_id = 3, pos = Vector2i(2,4)})
static func info(system: String, msg: String, data: Dictionary = {}) -> void:
    if OS.is_debug_build():
        print("[INFO] [%s] %s — %s" % [system, msg, str(data)])

static func warn(system: String, msg: String, data: Dictionary = {}) -> void:
    push_warning("[WARN] [%s] %s — %s" % [system, msg, str(data)])

static func error(system: String, msg: String, data: Dictionary = {}) -> void:
    push_error("[ERROR] [%s] %s — %s" % [system, msg, str(data)])
```

**Rules:**
- Release/WebGL builds: WARN and ERROR only (performance)
- No logging inside tight loops (AI tick inner logic, WS packet parsing) — log state changes only
- All log calls must include the system name as the first argument

### Configuration

**Three static config classes** — all in `res://config/`:

```
res://config/
  constants.gd   # Immutable game constants (GRID_SIZE, MAX_HEROES, BOMB_RADIUS)
  balance.gd     # Tunable gameplay values (STAMINA_DRAIN_PER_TICK, SPEED_BASE_INTERVAL)
  network.gd     # Environment URLs (API_BASE_URL, WS_URL, BSC_RPC_URL)
```

**Access pattern:**
```gdscript
# constants.gd
class_name Constants
const GRID_SIZE := Vector2i(20, 15)
const MAX_HEROES := 15
const BOMB_RADIUS := 1

# Usage anywhere:
var cols := Constants.GRID_SIZE.x
```

**Rule:** No magic numbers in game code. All numeric literals that represent game design values must be a named constant in `balance.gd` or `constants.gd`.

### Event System

**Pattern:** Godot built-in signals — no custom event bus.

**Signal naming convention:** `past_tense_verb_noun` (snake_case)

```gdscript
# Signals declared on ServerAPI autoload:
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)

# Connecting in HeroAI._ready():
func _ready() -> void:
    ServerAPI.bomb_validated.connect(_on_bomb_validated)
    ServerAPI.hero_move_confirmed.connect(_on_move_confirmed)
```

**Rules:**
- Autoloads expose signals; scene nodes connect in `_ready()` and disconnect in `_exit_tree()`
- No direct method calls across autoload boundaries — use signals
- All signal parameters must be typed

### Debug Tools

**All debug tools are gated by `OS.is_debug_build()`** — stripped automatically from release exports.

| Tool | Key | Function |
|---|---|---|
| Debug overlay | `F1` | Shows per-hero stats, stamina bars, grid positions, server ping |
| State dump | `F2` | Prints full `GameState` contents to console |
| WS message log | Auto (debug) | All WebSocket messages sent/received logged at DEBUG level |

**DebugPanel** added to main scene conditionally:
```gdscript
# Main.gd
func _ready() -> void:
    if OS.is_debug_build():
        var panel = preload("res://debug/debug_panel.tscn").instantiate()
        add_child(panel)
```

**No cheat commands** — server-authoritative design makes client cheats ineffective.

## Project Structure

### Organization Pattern

**Pattern:** Hybrid — type at top level, feature within.

**Rationale:** Most idiomatic for Godot 4. Top-level folders separate by artifact type (autoloads, scenes, src, assets); within `src/` folders are organized by game system/feature. This prevents the "everything in one folder" Godot anti-pattern while keeping related files discoverable.

### Directory Structure

```
res://
├── autoloads/                  # All Autoload singletons
│   ├── app_logger.gd
│   ├── game_state.gd
│   ├── web3_manager.gd         # JS bridge (MetaMask/BSC)
│   ├── server_api.gd           # WebSocket + REST
│   └── nft_cache.gd            # Disk cache read/write
│
├── config/                     # Static configuration classes
│   ├── constants.gd            # Immutable game constants
│   ├── balance.gd              # Tunable gameplay values
│   └── network.gd              # API/WS/RPC URLs
│
├── scenes/
│   ├── main.tscn               # Root scene (entry point)
│   ├── lobby/
│   │   └── lobby.tscn
│   ├── treasure_hunt/
│   │   └── treasure_hunt.tscn
│   └── rest/
│       └── rest.tscn
│
├── src/
│   ├── core/
│   │   ├── main.gd
│   │   └── game_phase_state_machine.gd
│   ├── hero/
│   │   ├── hero.gd             # Hero node (visual + data container)
│   │   ├── hero_ai.gd          # AI tick, grid movement, bomb logic
│   │   └── hero_data.gd        # HeroData resource (5 stats)
│   ├── map/
│   │   ├── grid_map.gd         # Grid state, cell occupancy
│   │   └── chest.gd            # Chest node (animated, server-driven)
│   ├── bomb/
│   │   └── bomb.gd             # Bomb node (visual + explosion anim)
│   ├── ui/
│   │   ├── hud.gd
│   │   ├── hero_card.gd
│   │   ├── lobby_ui.gd
│   │   └── rest_ui.gd
│   └── web3/
│       └── metamask_bridge.gd  # Low-level JS interop utilities
│
├── assets/
│   ├── sprites/
│   │   ├── heroes/
│   │   ├── map/
│   │   └── bomb/
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   └── ui/
│
└── debug/
    └── debug_panel.tscn        # Debug builds only
```

### System Location Mapping

| System | Location | Responsibility |
|---|---|---|
| AppLogger | `autoloads/app_logger.gd` | Structured logging utility |
| GameState | `autoloads/game_state.gd` | Session data (wallet, heroes, BCOIN) |
| Web3Manager | `autoloads/web3_manager.gd` | All JavaScriptBridge / BSC calls |
| ServerAPI | `autoloads/server_api.gd` | WebSocket connection + REST HTTP |
| NFTCache | `autoloads/nft_cache.gd` | Local JSON cache with TTL |
| Constants | `config/constants.gd` | GRID_SIZE, MAX_HEROES, BOMB_RADIUS |
| Balance | `config/balance.gd` | STAMINA_DRAIN_PER_TICK, speed formula |
| NetworkConfig | `config/network.gd` | API_BASE_URL, WS_URL, BSC_RPC_URL |
| Game phase FSM | `src/core/game_phase_state_machine.gd` | Lobby / TreasureHunt / Rest transitions |
| Hero node | `src/hero/hero.gd` | Visual representation + stat container |
| Hero AI | `src/hero/hero_ai.gd` | Staggered timer, movement, bomb intent |
| Hero stats | `src/hero/hero_data.gd` | Resource: power, speed, stamina, blast_range, bomb_count |
| Grid map | `src/map/grid_map.gd` | Cell occupancy, valid move queries |
| Chest | `src/map/chest.gd` | Animated chest; destroyed on server signal |
| Bomb | `src/bomb/bomb.gd` | Placed and exploded on server confirmation |
| HUD | `src/ui/hud.gd` | Stamina bars, BCOIN display, hero roster |
| MetaMask bridge | `src/web3/metamask_bridge.gd` | Low-level JS call helpers for Web3Manager |
| Debug panel | `debug/debug_panel.tscn` | F1/F2 tools, debug-only |

### Naming Conventions

#### Files

| Artifact | Convention | Example |
|---|---|---|
| GDScript files | `snake_case.gd` | `hero_ai.gd`, `server_api.gd` |
| Scene files | `snake_case.tscn` | `treasure_hunt.tscn` |
| Sprite assets | `subject_state_frame.png` | `hero_idle_01.png`, `chest_open.png` |
| Audio files | `subject_action.ogg` | `bomb_explode.ogg`, `bcoin_earn.ogg` |

#### Code Elements

| Element | Convention | Example |
|---|---|---|
| Class names | `PascalCase` | `class_name HeroAI` |
| Functions | `snake_case` | `func _on_bomb_validated()` |
| Variables | `snake_case` | `var stamina_value: float` |
| Constants | `UPPER_SNAKE_CASE` | `const MAX_HEROES := 15` |
| Signals | `past_tense_snake_case` | `signal bomb_planted` |
| Node names (in scene) | `PascalCase` | `HeroAI`, `GridMap`, `HUD` |
| Enum values | `UPPER_SNAKE_CASE` | `enum Phase { LOBBY, TREASURE_HUNT, REST }` |

### Architectural Boundaries

1. **`autoloads/`** → communicate with each other via signals only; never hold references to scene nodes
2. **`src/`** → scene nodes may call autoload methods and connect to autoload signals; autoloads never hold scene node references
3. **`src/web3/`** → only `autoloads/web3_manager.gd` may import from this folder; no other file uses `metamask_bridge.gd` directly
4. **`config/`** → read-only at runtime; no code writes to config class files; all values are GDScript constants
5. **`debug/`** → never imported by production code paths; always gated by `OS.is_debug_build()`
6. **`scenes/` ↔ `src/`** → each `.tscn` has exactly one root `.gd` script in the matching `src/` subfolder

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents. Every pattern has a concrete example — agents must follow the pattern structure, not just the concept.

### Novel Pattern 1: Server-Authoritative Idle Loop

**Purpose:** Heroes act autonomously on the client but every meaningful outcome is decided by the server. Must feel seamless despite async round-trips.

**Components:**

| Component | Role |
|---|---|
| `HeroAI` | Owns tick timer; decides intent locally |
| `ServerAPI` | Sends intents; receives confirmations via WebSocket |
| `GridMap` | Client-side occupancy tracking (optimistic) |
| `Hero` / `Chest` / `Bomb` | Animate on server confirmation signals |

**Data Flow:**
```
HeroAI timer fires
  → AI picks target cell (local GridMap query)
  → ServerAPI.send_move_intent(hero_id, target_cell)
  → Server validates → hero_move_confirmed OR hero_move_rejected
  → HeroAI._on_move_confirmed() → update GridMap → animate Hero

HeroAI decides to place bomb
  → ServerAPI.send_bomb_intent(hero_id, cell)
  → Server calculates destruction + reward
  → bomb_validated(hero_id, cell, chest_destroyed, reward)
  → Bomb plays explosion anim (only after confirmation)
  → HUD updates BCOIN display
```

**Optimistic vs. Confirmed rule:**
- **Movement:** Optimistic — hero visually moves immediately; snap back silently if server rejects
- **Bombs/Rewards:** Conservative — animation and reward display only after server confirmation

**Implementation:**
```gdscript
# hero_ai.gd
enum HeroState { IDLE, MOVING, WAITING_BOMB_CONFIRM, RESTING }
var state: HeroState = HeroState.IDLE
var current_cell: Vector2i
var reserved_cell: Vector2i

func _on_tick_timer_timeout() -> void:
    if state != HeroState.IDLE:
        return
    var target := _pick_adjacent_cell()
    if target == Vector2i(-1, -1):
        return
    state = HeroState.MOVING
    reserved_cell = target
    hero_node.move_to(target)           # optimistic visual
    GridMap.reserve_cell(target, hero_id)
    ServerAPI.send_move_intent(hero_id, target)

func _on_move_confirmed(confirmed_hero_id: int, cell: Vector2i) -> void:
    if confirmed_hero_id != hero_id:
        return
    current_cell = cell
    GridMap.confirm_cell(cell, hero_id)
    state = HeroState.IDLE
    _check_bomb_opportunity(cell)

func _on_move_rejected(rejected_hero_id: int) -> void:
    if rejected_hero_id != hero_id:
        return
    hero_node.move_to(current_cell)     # snap back silently
    GridMap.release_cell(reserved_cell, hero_id)
    state = HeroState.IDLE
    AppLogger.warn("HeroAI", "Move rejected", {hero_id = hero_id})
```

**When to use:** Any game action where the client initiates but the server decides the outcome.

---

### Novel Pattern 2: Web3 JavaScriptBridge Async Call

**Purpose:** Isolate all `JavaScriptBridge` / MetaMask calls in `Web3Manager`. Prevent GC of JS callbacks. Expose clean typed signals to the rest of the game.

**Components:**

| Component | Role |
|---|---|
| `Web3Manager` (Autoload) | Single owner of all `JavaScriptBridge` calls |
| `metamask_bridge.gd` | Builds JS eval strings; never called directly by game code |
| Callers | Connect to `Web3Manager` signals only |

**Critical rule:** JS callback objects **must be stored as member variables** on `Web3Manager`. Local variables are garbage-collected before the async JS callback fires.

**Implementation:**
```gdscript
# web3_manager.gd (Autoload)
signal wallet_connected(address: String)
signal wallet_error(message: String)
signal nft_metadata_received(token_id: int, stats: HeroData)
signal transaction_confirmed(tx_hash: String)

# Member vars — NEVER local vars — prevents GC before callback fires
var _wallet_callback: JavaScriptObject
var _metadata_callback: JavaScriptObject

func connect_wallet() -> void:
    _wallet_callback = JavaScriptBridge.create_callback(_on_wallet_callback)
    JavaScriptBridge.eval(MetaMaskBridge.build_connect_request(_wallet_callback))

func _on_wallet_callback(args: Array) -> void:
    var result: Dictionary = args[0]
    if result.has("error"):
        AppLogger.warn("Web3Manager", "Wallet connect failed", {msg = result["error"]})
        wallet_error.emit(result["error"])
        return
    GameState.wallet_address = result["address"]
    wallet_connected.emit(result["address"])

func fetch_nft_metadata(token_id: int) -> void:
    _metadata_callback = JavaScriptBridge.create_callback(
        func(args): _on_metadata_callback(token_id, args)
    )
    JavaScriptBridge.eval(MetaMaskBridge.build_metadata_request(token_id, _metadata_callback))

func _on_metadata_callback(token_id: int, args: Array) -> void:
    var stats := HeroData.from_dict(args[0])
    NFTCache.store(token_id, stats)
    nft_metadata_received.emit(token_id, stats)
```

**When to use:** Any interaction with MetaMask, BSC RPC, or browser JS APIs.

---

### Novel Pattern 3: NFT-Stat-Driven AI

**Purpose:** Hero AI behaviour (tick speed, bomb count, etc.) is derived from 5 on-chain stats parsed once into a typed `HeroData` Resource and never re-fetched during gameplay.

**Stat → Behaviour mapping:**

| Stat | Range | Client Behaviour | Server Use |
|---|---|---|---|
| `speed` | 1–10 | Tick interval: `BASE_INTERVAL - (speed * SPEED_STEP)` | — |
| `stamina` | 1–10 | Displayed only | Authoritative stamina cap |
| `power` | 1–10 | Sent in bomb intent payload | Damage calculation |
| `blast_range` | 1–10 | Sent in bomb intent payload | Blast radius validation |
| `bomb_count` | 1–5 | Max simultaneous bombs tracked locally | Validated server-side |

**HeroData Resource:**
```gdscript
# hero_data.gd
class_name HeroData
extends Resource

@export var token_id: int
@export var power: int
@export var speed: int
@export var stamina: int
@export var blast_range: int
@export var bomb_count: int

func get_move_interval() -> float:
    return Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)

func get_max_bombs() -> int:
    return bomb_count

static func from_dict(data: Dictionary) -> HeroData:
    var h := HeroData.new()
    h.token_id   = data.get("token_id", 0)
    h.power      = clampi(data.get("power", 1), 1, 10)
    h.speed      = clampi(data.get("speed", 1), 1, 10)
    h.stamina    = clampi(data.get("stamina", 1), 1, 10)
    h.blast_range = clampi(data.get("range", 1), 1, 10)
    h.bomb_count = clampi(data.get("bomb_count", 1), 1, 5)
    return h
```

**Spawn flow:**
```gdscript
# treasure_hunt.gd
func _spawn_heroes() -> void:
    for token_id in GameState.active_hero_ids:
        var stats := NFTCache.get_hero_stats(token_id)
        if stats == null:
            AppLogger.warn("Core", "No cached stats for token", {token_id = token_id})
            continue
        var cell := GridMap.get_free_spawn_cell()
        var hero := HeroFactory.create(token_id, stats, cell)
        add_child(hero)
```

**When to use:** Any system that needs hero stat data — always go through the `HeroData` Resource, never parse raw NFT data inline.

---

### Standard Patterns

**Entity Creation — HeroFactory:**
```gdscript
# src/hero/hero_factory.gd
class_name HeroFactory

static func create(token_id: int, stats: HeroData, spawn_cell: Vector2i) -> Hero:
    var hero := preload("res://scenes/treasure_hunt/hero.tscn").instantiate()
    hero.initialize(token_id, stats, spawn_cell)
    return hero
```

**Data Access — Resource + Autoload + Config:**
```gdscript
# In any hero script — read stats from injected HeroData Resource
var interval := data.get_move_interval()

# Read config from static class
var max_heroes := Constants.MAX_HEROES

# Read session data from autoload
var wallet := GameState.wallet_address
```

### Consistency Rules

| Pattern | Rule | Violation Example |
|---|---|---|
| JS bridge calls | Only `Web3Manager` calls `JavaScriptBridge` | Any other file calling `JavaScriptBridge.eval()` |
| Server intents | Only `HeroAI` sends intents; only `ServerAPI` receives confirmations | HUD directly calling `ServerAPI.send_bomb_intent()` |
| Stat access | Always via `HeroData` Resource methods | Hardcoding `speed * 0.1` inline in `HeroAI` |
| Signal connections | Connect in `_ready()`, disconnect in `_exit_tree()` | Connecting signals in `_process()` or `_input()` |
| Config values | Always named constants from `config/*.gd` | Using `15` instead of `Constants.MAX_HEROES` |
| Error on server reject | Log WARN, skip action, continue idle loop | Crashing, retrying, or showing error to player |

## Architecture Validation

### Validation Summary

| Check | Result | Notes |
|---|---|---|
| Decision Completeness | ✅ Pass | All 7 critical decisions resolved, no TBD text |
| Version Specificity | ✅ Pass | Godot 4.6 verified via web search (2026-02-21) |
| Starter Template | ✅ Pass | "From scratch" documented; MCPs accepted and documented |
| Novel Pattern Design | ✅ Pass | 3 novel patterns — components, data flow, examples, edge cases all present |
| Implementation Patterns | ✅ Pass | All categories covered with concrete GDScript examples |
| Technology Compatibility | ✅ Pass | All choices compatible with WebGL/HTML5 constraints |
| Document Structure | ✅ Pass | Executive summary added; all required sections present |
| AI Agent Clarity | ✅ Pass | No ambiguous decisions; explicit file placement and boundary rules |
| System Coverage | ✅ Pass | All 9 core systems mapped to architecture locations |

### Coverage Report

**Systems Covered:** 9 / 9
**Novel Patterns Defined:** 3
**Standard Patterns Defined:** 4
**Architectural Decisions Made:** 7
**Autoload Singletons:** 5 (AppLogger, GameState, Web3Manager, ServerAPI, NFTCache)

### Issues Found and Resolved

| Issue | Resolution |
|---|---|
| Missing Executive Summary | Added 3-sentence summary capturing engine, Web3 isolation, server protocol, and AI tick system |
| MCP versions not pinned | Accepted as minor — `npm install` pulls latest; not on critical path |

### Validation Date

2026-02-21

## Development Environment

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Godot Engine | 4.6 (stable) | Game engine — download from godotengine.org |
| Node.js | 18+ | Required for godot-mcp MCP server |
| Web browser | Chrome / Firefox (latest) | Primary test target; MetaMask extension required |
| MetaMask | Latest browser extension | Wallet for BSC wallet connect testing |

### AI Tooling (MCP Servers)

The following MCP servers were selected during architecture to enhance AI-assisted development:

| MCP Server | Purpose | Install Type |
|---|---|---|
| godot-mcp (bradypp) | Scene editing, debug output, project launch from AI | Node.js (no Godot plugin needed) |
| Context7 (upstash) | Live Godot 4.x API docs in AI prompts | npx / Node.js |

**Setup — godot-mcp:**
```bash
git clone https://github.com/bradypp/godot-mcp.git
cd godot-mcp
npm install
npm run build
# Then configure your MCP client to point to the built index.js
```

**Setup — Context7:**
```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

These give your AI assistant direct access to Godot 4.6 for scene inspection, node queries, error capture, and context-aware code generation without needing to paste scene dumps into chat.

### Project Setup Commands

```bash
# 1. Download and install Godot 4.6 from https://godotengine.org/releases/
# 2. Create a new blank project via Godot Project Manager
# 3. Set up the directory structure per the Project Structure section
# 4. Create initial autoload files and register them in Project > Project Settings > Autoload:
#      autoloads/app_logger.gd      → AppLogger
#      autoloads/game_state.gd      → GameState
#      autoloads/web3_manager.gd    → Web3Manager
#      autoloads/server_api.gd      → ServerAPI
#      autoloads/nft_cache.gd       → NFTCache
# 5. Create config/ static classes: constants.gd, balance.gd, network.gd
# 6. Set main scene to scenes/main.tscn in Project Settings
# 7. Configure HTML5 export preset in Project > Export
```

### First Steps

1. Create the directory structure as defined in the Project Structure section
2. Stub out all 5 autoloads with empty signal declarations
3. Implement `constants.gd`, `balance.gd`, `network.gd` with initial values
4. Build the `GamePhaseStateMachine` with the three phases: `Lobby`, `TreasureHunt`, `Rest`
5. Implement `Web3Manager` wallet connect flow (Novel Pattern 2) as the first testable milestone

---

_Generated by BMAD GDS Architecture Workflow v2.0.0_
_Date: 2026-02-21_
_For: Admin_

