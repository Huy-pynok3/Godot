---
project_name: 'BombCrypto Remake'
user_name: 'Admin'
date: '2026-02-21'
sections_completed: ['technology_stack', 'engine_rules', 'performance_rules', 'organization_rules', 'platform_rules', 'anti_patterns']
status: 'complete'
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing game code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Technology | Version | Notes |
|---|---|---|
| Godot Engine | 4.6 (stable) | WebGL/HTML5 primary export; PC secondary |
| GDScript | Godot 4.6 built-in | Only scripting language used — no C# |
| Rendering | Compatibility renderer | Required for WebGL/HTML5 export (NOT Forward+) |
| Target browser | Chrome / Firefox latest | MetaMask extension required for testing |
| MetaMask | Latest browser extension | Binance Smart Chain (BSC) network |
| godot-mcp | Latest (bradypp) | Node.js MCP — scene/debug access for AI |
| Context7 | Latest (@upstash) | Live Godot 4.x API doc lookup for AI |
| Backend | Custom (not yet built) | REST + WebSocket; server-authoritative |

> **IMPORTANT — Renderer:** WebGL/HTML5 export requires the **Compatibility renderer**, not Forward+. If `project.godot` shows `"Forward Plus"` in features, switch to Compatibility before HTML5 export. Never add Forward+ or Vulkan-specific features.

## Critical Implementation Rules

### Godot 4.x Engine Rules

**Node Lifecycle:**
- Use `_ready()` for logic that requires the node to be in the SceneTree (connecting signals, accessing child nodes)
- Use `_enter_tree()` only when you need the node registered before children are ready — rare; prefer `_ready()`
- Never access child nodes in `_init()` — they don't exist yet
- Always disconnect signals in `_exit_tree()` when connecting to external nodes or autoloads; Godot 4 does NOT auto-disconnect on node free

**Signals — Typed and Explicit:**
- All signals must declare typed parameters: `signal bomb_validated(hero_id: int, position: Vector2i, destroyed: bool)`
- Never use `Object.connect()` string form — always use the typed `.connect()` callable form
- Connect to autoload signals in `_ready()`, disconnect in `_exit_tree()`
- Autoloads must never store references to scene nodes — only emit signals back

**Autoloads:**
- 5 autoloads in this project: `AppLogger`, `GameState`, `Web3Manager`, `ServerAPI`, `NFTCache`
- Access autoloads by name directly: `GameState.wallet_address` — never use `get_node("/root/GameState")`
- Never call autoload methods from another autoload's `_ready()` — load order is not guaranteed; use signals instead

**await / Coroutines:**
- Use `await` for timer waits: `await get_tree().create_timer(1.0).timeout`
- Use `await signal_name` to wait for a signal: `await ServerAPI.bomb_validated`
- Never use `yield` — it is Godot 3 syntax and does not exist in Godot 4
- Never `await` inside `_process()` or `_physics_process()` — it suspends the entire function

**Static Config Classes:**
- `constants.gd`, `balance.gd`, `network.gd` use `class_name` and `const` — never instantiated
- Access as `Constants.GRID_SIZE`, `Balance.SPEED_BASE_INTERVAL`, `NetworkConfig.API_BASE_URL`
- Never use `load()` or `preload()` on config files — they are static GDScript classes

**Resources:**
- `HeroData` extends `Resource` — always instantiate with `HeroData.new()` or `HeroData.from_dict()`
- Never share a single `HeroData` instance between multiple heroes — each hero gets its own instance
- `@export` vars on Resources are serializable; do not add non-serializable types as `@export`

**JavaScriptBridge — CRITICAL:**
- `JavaScriptBridge` only works in HTML5/WebGL export — guard with `if OS.has_feature("web")` for any platform-conditional code
- JS callback objects from `JavaScriptBridge.create_callback()` MUST be stored as **member variables** — local variables are GC'd before the async callback fires, causing silent failures with no error
- Only `Web3Manager` autoload may call `JavaScriptBridge` — no other file in the project
- All MetaMask calls are async — never expect synchronous results; always use signals for response handling

### Performance Rules

**WebGL/HTML5 Constraints:**
- No threads — `Thread` class does not work in HTML5 export; never use `Thread.new()` or `Mutex`
- No raw TCP sockets — use only `WebSocketPeer` or `HTTPClient` for networking
- Memory budget is limited — keep total scene memory under ~256MB; avoid loading large texture atlases all at once
- No blocking I/O per frame — `FileAccess` reads are synchronous on HTML5; never read files inside `_process()`

**Hero AI Tick Loop (15 concurrent heroes):**
- Each `HeroAI` owns one `Timer` node — never use `_process()` for AI tick logic
- Never log inside the timer callback's inner decision logic — log only on state transitions (moved, bombed, rejected)
- Hero timers are staggered at spawn (random 0–2s offset) — never start all timers simultaneously
- AI decisions must be O(1) or O(adjacent cells) — no full grid scans per tick

**WebSocket / Network:**
- `WebSocketPeer` must be polled every frame — call `websocket.poll()` in `_process()` then read packets
- Never send WebSocket messages inside `_physics_process()` — use `_process()` only
- Batch outgoing messages where possible — do not send one packet per hero per tick

**Asset Loading:**
- Use `preload()` for scenes and resources known at compile time (hero scene, bomb scene, chest scene)
- On WebGL, all asset loading is synchronous — do not use `ResourceLoader.load_threaded_request()`
- No object pooling required — max 15 heroes, ~30 bombs/chests; keep instantiation simple

### Code Organization Rules

**Directory Rules — Where Things Go:**
- `autoloads/` — only the 5 defined singletons; never add new autoloads without architectural approval
- `src/hero/` — all hero logic (Hero, HeroAI, HeroData, HeroFactory)
- `src/map/` — GridMap and Chest only
- `src/bomb/` — Bomb node only
- `src/ui/` — all Control/UI scripts
- `src/web3/` — only `metamask_bridge.gd`; only imported by `Web3Manager`
- `config/` — only the 3 static config classes; never add runtime-writable files here
- `debug/` — debug tools only; never imported by production code paths

**One Script Per Scene Rule:**
- Each `.tscn` has exactly one root `.gd` script in the matching `src/` subfolder
- Never attach inline scripts to child nodes in the scene editor — always use external `.gd` files

**Naming Conventions:**

| Element | Convention | Example |
|---|---|---|
| GDScript files | `snake_case.gd` | `hero_ai.gd` |
| Scene files | `snake_case.tscn` | `treasure_hunt.tscn` |
| Class names | `PascalCase` | `class_name HeroAI` |
| Functions | `snake_case` | `func _on_bomb_validated()` |
| Variables | `snake_case` | `var stamina_value: float` |
| Constants | `UPPER_SNAKE_CASE` | `const MAX_HEROES := 15` |
| Signals | `past_tense_snake_case` | `signal bomb_planted` |
| Node names (scene) | `PascalCase` | `HeroAI`, `GridMap` |
| Enum values | `UPPER_SNAKE_CASE` | `LOBBY`, `TREASURE_HUNT`, `REST` |

**No Magic Numbers:**
- All numeric game design values must be named constants in `config/constants.gd` or `config/balance.gd`
- Never write `15`, `2.0`, `0.1` inline in game logic — reference `Constants.MAX_HEROES`, `Balance.SPEED_BASE_INTERVAL`

### Platform & Build Rules

**WebGL/HTML5 Export (Primary):**
- Export renderer must be **Compatibility** — set in Project Settings > Rendering > Renderer
- `OS.has_feature("web")` returns `true` in HTML5 export — gate all JavaScriptBridge/Web3 code behind this check
- `OS.is_debug_build()` returns `true` in editor and debug exports — use to gate DebugPanel and verbose logging
- HTML5 export persistent storage (`user://`) may behave differently across browsers — test on Chrome primarily
- Game must be served over HTTPS in production for MetaMask to connect; `http://localhost` is acceptable for local dev

**PC Export (Secondary):**
- `Web3Manager` must gracefully no-op on non-web platforms — all `JavaScriptBridge` calls inside `if OS.has_feature("web")`
- PC export uses Forward+ renderer — only HTML5 requires Compatibility renderer

**Debug vs. Release:**
- `OS.is_debug_build()` true → AppLogger INFO/DEBUG enabled, DebugPanel loaded, verbose WS logging
- `OS.is_debug_build()` false → AppLogger WARN/ERROR only; no DebugPanel; no verbose output
- Never add the DebugPanel unconditionally — always gated: `if OS.is_debug_build(): add_child(debug_panel)`

**Input:**
- Minimal player input (idle game) — use `InputMap` actions for clickable UI; never hardcode `MOUSE_BUTTON_LEFT` in game nodes
- Touch input not required for V1 — desktop browser only

### Critical Don't-Miss Rules

**Server Authority — Never Violate:**
- NEVER calculate rewards, BCOIN amounts, or chest destruction outcomes on the client
- NEVER treat client-side stamina as authoritative — display only; server is the source of truth
- NEVER skip the server round-trip for bomb validation — the idle loop absorbs latency
- NEVER auto-retry a rejected server action — log WARN, skip the action, continue the idle loop
- Client is a "dumb renderer" — sends intents, animates confirmed results, nothing more

**Web3 / MetaMask Gotchas:**
- `JavaScriptBridge.create_callback()` returns a `JavaScriptObject` — store in a **member variable** or it is silently GC'd with no error
- MetaMask popups are blocked if not triggered by a direct user gesture (click) — never call wallet connect from `_ready()` or a timer
- BSC RPC calls can be rate-limited — never batch-fetch all NFT metadata simultaneously; stagger requests
- NFT ownership must be re-validated server-side at session start — client cache is for speed, never for authority

**Autoload Boundary Rules:**
- Autoloads NEVER hold `Node` references from the scene tree — only plain data and signals
- Scene nodes connect TO autoload signals — autoloads never call methods on scene nodes directly
- `ServerAPI` is the only place that touches `WebSocketPeer` — no other script accesses the socket directly
- `NFTCache` is the only place that reads/writes `user://nft_cache.json`

**HeroAI State Machine:**
- Always check `state != HeroState.IDLE` at the start of the tick callback — never process a new tick while waiting for server confirmation
- Movement is optimistic (visual move immediately); bombs are conservative (animate only after server confirms)
- `reserved_cell` MUST be released in `_on_move_rejected()` — forgetting permanently blocks that grid cell

**Godot 4 vs. Godot 3 — Never Use Godot 3 Syntax:**
- `yield()` → `await`
- `connect("signal", self, "_method")` → `signal_name.connect(_method)`
- `onready var` → `@onready var`
- `export var` → `@export var`
- `get_node("/root/AutoloadName")` → access autoload by class name directly: `GameState.wallet_address`

**AppLogger Usage:**
- First argument is always the system name: `AppLogger.warn("HeroAI", "Move rejected", {hero_id = id})`
- Never call `print()` directly in game code — always use `AppLogger`
- Never log inside tight loops — log on state changes only (moved, bombed, rejected)

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any game code in this project
- Follow ALL rules exactly as documented — no exceptions without explicit user approval
- When in doubt, prefer the more restrictive option (e.g., conservative over optimistic, server-validated over client-calculated)
- Never add `print()` calls — use `AppLogger` with the system name
- Never touch `JavaScriptBridge` outside `Web3Manager`
- Never calculate game outcomes on the client

**For Humans:**
- Keep this file lean — only rules that agents would otherwise get wrong
- Update when technology stack or patterns change
- Remove rules that become obvious as the codebase matures

_Last Updated: 2026-02-21_
_Generated by BMAD GDS Generate Project Context Workflow_
