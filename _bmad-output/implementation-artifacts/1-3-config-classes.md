# Story 1.3: Config Classes

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want 3 static config classes with default values in `res://config/`,
so that no magic numbers appear in game code — all constants are named and centrally defined.

## Acceptance Criteria

1. `config/constants.gd` exists with `class_name Constants` and:
   - `const GRID_SIZE := Vector2i(20, 15)`
   - `const MAX_HEROES := 15`
   - `const BOMB_RADIUS := 1`
2. `config/balance.gd` exists with `class_name Balance` and:
   - `const SPEED_BASE_INTERVAL := 2.0`
   - `const SPEED_STEP := 0.1`
   - `const STAMINA_DRAIN_PER_TICK := 1.0`
   - `const NFT_CACHE_TTL_SECONDS := 3600`
3. `config/network.gd` exists with `class_name NetworkConfig` and:
   - `const API_BASE_URL := "http://localhost:3000"`
   - `const WS_URL := "ws://localhost:3000/ws"`
   - `const BSC_RPC_URL := "https://data-seed-prebsc-1-s1.binance.org:8545"` (BSC testnet)
4. All three files use `const` declarations — no `var`, no `@export`, no class instantiation
5. All three classes are accessible via their class name globally: `Constants.GRID_SIZE`, `Balance.SPEED_BASE_INTERVAL`, `NetworkConfig.API_BASE_URL`
6. None of the files have any function definitions or lifecycle methods
7. `config/.gitkeep` is removed (replaced by real files)

## Tasks / Subtasks

- [x] Task 1: Create `config/constants.gd` (AC: #1, #4, #5, #6)
  - [x] File at exactly `res://config/constants.gd`
  - [x] `class_name Constants` declaration (no `extends` needed)
  - [x] `const GRID_SIZE := Vector2i(20, 15)`
  - [x] `const MAX_HEROES := 15`
  - [x] `const BOMB_RADIUS := 1`
- [x] Task 2: Create `config/balance.gd` (AC: #2, #4, #5, #6)
  - [x] File at exactly `res://config/balance.gd`
  - [x] `class_name Balance` declaration
  - [x] `const SPEED_BASE_INTERVAL := 2.0`
  - [x] `const SPEED_STEP := 0.1`
  - [x] `const STAMINA_DRAIN_PER_TICK := 1.0`
  - [x] `const NFT_CACHE_TTL_SECONDS := 3600`
- [x] Task 3: Create `config/network.gd` (AC: #3, #4, #5, #6)
  - [x] File at exactly `res://config/network.gd`
  - [x] `class_name NetworkConfig` (NOT "Network" — see Dev Notes)
  - [x] `const API_BASE_URL := "http://localhost:3000"`
  - [x] `const WS_URL := "ws://localhost:3000/ws"`
  - [x] `const BSC_RPC_URL := "https://data-seed-prebsc-1-s1.binance.org:8545"`
- [x] Task 4: Remove `config/.gitkeep` (AC: #7)
  - [x] Delete `config/.gitkeep` since directory now has real files

## Dev Notes

### What This Story Does

Creates three read-only static configuration classes that eliminate all magic numbers from game code. Unlike AppLogger (which is an autoload node accessed by instance name), config classes use `class_name` so they are accessible as compile-time globals — no autoload registration, no node in the scene tree, no instantiation ever.

### Exact Implementation

```gdscript
# config/constants.gd
class_name Constants

const GRID_SIZE := Vector2i(20, 15)
const MAX_HEROES := 15
const BOMB_RADIUS := 1
```

```gdscript
# config/balance.gd
class_name Balance

const SPEED_BASE_INTERVAL := 2.0
const SPEED_STEP := 0.1
const STAMINA_DRAIN_PER_TICK := 1.0
const NFT_CACHE_TTL_SECONDS := 3600
```

```gdscript
# config/network.gd
class_name NetworkConfig

const API_BASE_URL := "http://localhost:3000"
const WS_URL := "ws://localhost:3000/ws"
const BSC_RPC_URL := "https://data-seed-prebsc-1-s1.binance.org:8545"
```

### Critical: Class Name for network.gd

`class_name NetworkConfig` — NOT `Network`. The project-context explicitly documents access as `NetworkConfig.API_BASE_URL`. Using `Network` would conflict with Godot 4's built-in `NetworkedMultiplayerCustom` namespace and cause ambiguity. Every future story that uses network config must reference `NetworkConfig.*`.

### Why No `extends`?

These files have no `extends` declaration. In Godot 4, a script without `extends` implicitly extends `RefCounted`. Since these classes are NEVER instantiated (only their `const` values are read), this is irrelevant. Do NOT add `extends Node` or `extends RefCounted` — keep the files minimal.

### How Config Classes Differ from AppLogger (Autoload)

| | AppLogger | Config Classes |
|---|---|---|
| File location | `autoloads/` | `config/` |
| Registered in project.godot | Yes (Autoload) | **No** |
| Access mechanism | Autoload node name | `class_name` global |
| Has instance in scene tree | Yes (at `/root/AppLogger`) | **No** |
| Has `extends` | `extends Node` | None needed |
| Method type | `static func` | `const` only |
| Usage | `AppLogger.info(...)` | `Constants.GRID_SIZE` |

Config classes do NOT need to be added to project.godot. `class_name` in Godot 4 makes them globally accessible to all GDScript files automatically.

### Access Patterns (for all future stories)

```gdscript
# Access game constants:
var cols := Constants.GRID_SIZE.x        # → 20
var rows := Constants.GRID_SIZE.y        # → 15
var max := Constants.MAX_HEROES          # → 15
var radius := Constants.BOMB_RADIUS      # → 1

# Access balance values:
var interval := Balance.SPEED_BASE_INTERVAL  # → 2.0
var step := Balance.SPEED_STEP               # → 0.1
var drain := Balance.STAMINA_DRAIN_PER_TICK  # → 1.0
var ttl := Balance.NFT_CACHE_TTL_SECONDS     # → 3600

# Access network config:
var api := NetworkConfig.API_BASE_URL        # → "http://localhost:3000"
var ws := NetworkConfig.WS_URL               # → "ws://localhost:3000/ws"
var rpc := NetworkConfig.BSC_RPC_URL         # → BSC testnet URL

# WRONG — never do these:
var c := Constants.new()                 # Never instantiate
load("res://config/constants.gd")       # Never load/preload config files
var g := Constants.GRID_SIZE            # Fine — but don't store in var if you only need it once
```

### Rule: No Magic Numbers in Game Code

After this story, any numeric literal that represents a game design value must be a named constant here. Violating stories will fail code review:

| Magic number | Correct form |
|---|---|
| `15` (hero count) | `Constants.MAX_HEROES` |
| `2.0` (speed base) | `Balance.SPEED_BASE_INTERVAL` |
| `0.1` (speed step) | `Balance.SPEED_STEP` |
| `3600` (cache TTL) | `Balance.NFT_CACHE_TTL_SECONDS` |

### Network Config — Placeholder Values

The network URLs are development placeholders. In production they will point to real endpoints. The architecture does not define final URLs — BSC_RPC_URL uses BSC testnet (`data-seed-prebsc-1-s1.binance.org`) as a safe dev default. These will be updated in ST-9.x (WebGL export and production config).

### Project Structure Notes

- Files go in `res://config/` — per architecture directory structure
- Remove `config/.gitkeep` after creating the three files (same pattern as ST-1.2 removed `autoloads/.gitkeep`)
- These files create **no autoload entries** in `project.godot`
- Do NOT add these to project.godot's `[autoload]` section — that would be wrong

### Previous Story Learnings

- ST-1.1: `config/.gitkeep` exists — remove it once real files are added
- ST-1.2: AppLogger has NO `class_name` (autoload node pattern); config classes have `class_name` (global static pattern) — these are fundamentally different access mechanisms
- ST-1.2: Runtime verification in Godot editor isn't possible during AI implementation; note this clearly in completion notes rather than claiming it was done
- ST-1.1/1.2 code review: `project.godot` changes should not break existing `[application]` or `[rendering]` sections — verify file integrity after any edits

### References

- Config classes specification: [Source: game-architecture.md#Configuration]
- Class name access pattern: [Source: project-context.md#Static-Config-Classes]
- No-magic-numbers rule: [Source: game-architecture.md#Consistency-Rules]
- Epic 1 ST-1.3 AC: [Source: epics/epic-1-project-setup.md#ST-1.3]
- Hero AI uses Balance: [Source: game-architecture.md#NFT-Stat-Driven-AI] — `Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)`

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — static data files; no runtime logic to debug.

### Completion Notes List

- Created `config/constants.gd` with `class_name Constants` and 3 consts: GRID_SIZE, MAX_HEROES, BOMB_RADIUS
- Created `config/balance.gd` with `class_name Balance` and 4 consts: SPEED_BASE_INTERVAL, SPEED_STEP, STAMINA_DRAIN_PER_TICK, NFT_CACHE_TTL_SECONDS
- Created `config/network.gd` with `class_name NetworkConfig` and 3 URL consts (dev/testnet placeholders)
- Godot auto-generated `.uid` files for each script (normal behavior — committed alongside source)
- Removed `config/.gitkeep`; directory now has 6 files (3x .gd + 3x .uid)
- All ACs verified via static code inspection; no Godot runtime available during AI implementation
- No autoload registration in project.godot (class_name provides global access without it)

### Change Log

- 2026-02-21: Created constants.gd, balance.gd, network.gd in config/; removed config/.gitkeep

### File List

- `config/constants.gd` (new)
- `config/constants.gd.uid` (new — Godot auto-generated)
- `config/balance.gd` (new)
- `config/balance.gd.uid` (new — Godot auto-generated)
- `config/network.gd` (new)
- `config/network.gd.uid` (new — Godot auto-generated)
- `config/.gitkeep` (deleted)
