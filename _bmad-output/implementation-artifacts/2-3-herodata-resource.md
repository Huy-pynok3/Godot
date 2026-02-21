# Story 2.3: HeroData Resource

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a `HeroData` Resource class with 5 on-chain stats and derived behaviour methods,
so that every system reads hero stats through one unified, typed interface.

## Acceptance Criteria

1. `class_name HeroData extends Resource` — located at `src/hero/hero_data.gd` (stub already exists)
2. Five `@export var` fields: `token_id: int`, `power: int`, `speed: int`, `stamina: int`, `blast_range: int`, `bomb_count: int` (note: field is `blast_range` not `range` — GDScript built-in conflict)
3. `func get_move_interval() -> float` returns `Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)` — no magic numbers
4. `func get_max_bombs() -> int` returns `bomb_count`
5. `static func from_dict(data: Dictionary) -> HeroData` — creates a new `HeroData` instance with all 5 stats clamped to valid ranges; `token_id` is stored but not clamped
6. `from_dict()` clamps: `power`, `speed`, `stamina`, `range` to `1–10` via `clampi()`; `bomb_count` to `1–5` via `clampi()`
7. Each hero instance has its own `HeroData` — `from_dict()` always calls `HeroData.new()`, never returns a shared instance
8. No `print()` calls — `from_dict()` is a pure factory function with no side effects; no AppLogger calls needed

## Tasks / Subtasks

- [x] Task 1: Implement `HeroData` Resource in `src/hero/hero_data.gd` (AC: #1, #2, #3, #4, #5, #6, #7, #8)
  - [x] Replace stub body with full implementation (preserve `class_name HeroData` and `extends Resource`)
  - [x] Add `@export var token_id: int`
  - [x] Add `@export var power: int`
  - [x] Add `@export var speed: int`
  - [x] Add `@export var stamina: int`
  - [x] Add `@export var blast_range: int` (renamed from `range` — GDScript built-in conflict, see Dev Agent Record)
  - [x] Add `@export var bomb_count: int`
  - [x] Implement `func get_move_interval() -> float` using `Balance.SPEED_BASE_INTERVAL` and `Balance.SPEED_STEP`
  - [x] Implement `func get_max_bombs() -> int` returning `bomb_count`
  - [x] Implement `static func from_dict(data: Dictionary) -> HeroData`
    - [x] Call `HeroData.new()` — never reuse an existing instance
    - [x] Set `h.token_id = data.get("token_id", 0)` — no clamp (token IDs are arbitrary uint256 values)
    - [x] Set `h.power = clampi(data.get("power", 1), 1, 10)`
    - [x] Set `h.speed = clampi(data.get("speed", 1), 1, 10)`
    - [x] Set `h.stamina = clampi(data.get("stamina", 1), 1, 10)`
    - [x] Set `h.blast_range = clampi(data.get("range", 1), 1, 10)` (JSON key is "range", GDScript field is blast_range)
    - [x] Set `h.bomb_count = clampi(data.get("bomb_count", 1), 1, 5)`
    - [x] Return `h`

## Dev Notes

### What This Story Does

Creates the `HeroData` Resource — the single typed container for all NFT hero stats used throughout the game. It is the output of the NFT metadata parse pipeline (ST-2.4), the input to HeroAI tick logic (Epic 5), and the value stored in NFTCache (ST-2.5).

**This story modifies ONE file only:**
- `src/hero/hero_data.gd` — replaces the stub with full implementation

**What it does NOT do:**
- Does NOT fetch NFT data (that's ST-2.4 `Web3Manager.fetch_nft_metadata`)
- Does NOT write to cache (that's ST-2.5 `NFTCache`)
- Does NOT create Hero scene nodes (that's Epic 5)
- Does NOT modify `web3_manager.gd`, `nft_cache.gd`, or any other file

### Existing Stub State

`src/hero/hero_data.gd` currently contains:
```gdscript
class_name HeroData
extends Resource
```
(2 lines, no fields, no methods — created in Epic 1 ST-1.1 as a stub)

`src/hero/hero_data.gd.uid` already exists — do NOT delete it or create a new one.

Both `web3_manager.gd` and `nft_cache.gd` already reference `HeroData` in their signal/method signatures:
- `signal nft_metadata_received(token_id: int, stats: HeroData)` — in `web3_manager.gd`
- `func get_hero_stats(_token_id: int) -> HeroData:` — in `nft_cache.gd`

These will stop generating "unresolved class" parse warnings once `HeroData` has real fields.

### Class Design — Full Implementation

```gdscript
# src/hero/hero_data.gd
class_name HeroData
extends Resource

@export var token_id: int
@export var power: int
@export var speed: int
@export var stamina: int
@export var range: int
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
	h.range      = clampi(data.get("range", 1), 1, 10)
	h.bomb_count = clampi(data.get("bomb_count", 1), 1, 5)
	return h
```

This is taken directly from `game-architecture.md#Novel-Pattern-3`. The dev agent must follow this exactly.

### CRITICAL: @export on All Stat Fields

All 6 fields (`token_id`, `power`, `speed`, `stamina`, `range`, `bomb_count`) MUST use `@export var` — not plain `var`.

**Why `@export`:**
- `HeroData extends Resource` — `@export` vars are serializable; allows Godot editor inspection and future `.tres` file saving
- `NFTCache` will store and reload `HeroData` objects — serializable fields are required for this (ST-2.5)
- `@export` on a `Resource` subclass does NOT mean "exposed in scene inspector" — it means "serializable field"

**Rule from `project-context.md`:**
> `@export` vars on Resources are serializable; do not add non-serializable types as `@export`

All 6 fields are `int` or `float` — fully serializable. ✅

### CRITICAL: No Magic Numbers

`get_move_interval()` MUST use `Balance.SPEED_BASE_INTERVAL` and `Balance.SPEED_STEP`:

```gdscript
# CORRECT:
func get_move_interval() -> float:
    return Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)

# WRONG — magic numbers, architectural violation:
func get_move_interval() -> float:
    return 2.0 - (speed * 0.1)
```

`Balance.SPEED_BASE_INTERVAL = 2.0` and `Balance.SPEED_STEP = 0.1` are defined in `config/balance.gd`.

### CRITICAL: from_dict() Always Creates New Instance

From `project-context.md#Resources`:
> Never share a single `HeroData` instance between multiple heroes — each hero gets its own instance

`from_dict()` MUST call `HeroData.new()` every time. It must never receive or return a cached/shared instance.

### CRITICAL: clampi() Not clamp()

Godot 4 has TWO clamp functions:
- `clampi(value: int, min: int, max: int) -> int` — for integers ✅
- `clampf(value: float, min: float, max: float) -> float` — for floats
- `clamp()` — generic, works but less explicit

All stat fields are `int` — use `clampi()` for type correctness.

### Stat Ranges Reference

| Field | Default (missing key) | Clamp Min | Clamp Max | Notes |
|---|---|---|---|---|
| `token_id` | `0` | none | none | NFT token ID — arbitrary uint256, don't clamp |
| `power` | `1` | `1` | `10` | Bomb damage multiplier (server-side) |
| `speed` | `1` | `1` | `10` | Drives `get_move_interval()` tick speed |
| `stamina` | `1` | `1` | `10` | Stamina cap — server authoritative display |
| `range` | `1` | `1` | `10` | Bomb blast radius (server-side validation) |
| `bomb_count` | `1` | `1` | `5` | Max simultaneous bombs — different upper bound! |

`bomb_count` max is `5`, not `10` — different from the other stats. Per `game-architecture.md#Novel-Pattern-3`.

### get_move_interval() Edge Cases

- `speed = 1` (min): `2.0 - (1 * 0.1)` = `1.9` seconds/tick
- `speed = 10` (max): `2.0 - (10 * 0.1)` = `1.0` seconds/tick
- After clamping, `speed` is always 1–10, so `get_move_interval()` always returns 1.0–1.9 — never negative, never zero. No additional guard needed.

### No Testing Framework

Godot 4.6 has no built-in unit test runner. The project does not use GUT or gdUnit. Testing strategy:
- Verify the class parses and project runs clean (no errors)
- Manual verification: instantiate `HeroData.from_dict({"token_id": 5, "power": 3, "speed": 7, "stamina": 4, "range": 2, "bomb_count": 2})` in a `_ready()` function and verify `get_move_interval()` returns `1.3`
- Clamp verification: pass out-of-range values (e.g., `power: 15`) and confirm they are clamped to `10`
- The dev agent should use `AppLogger.info()` temporarily in `main.gd._ready()` to print a smoke-test result, then remove it

### Files NOT to Touch

- `autoloads/web3_manager.gd` — already has correct signal type `HeroData`; no change needed
- `autoloads/nft_cache.gd` — already has correct return type `HeroData`; no change needed
- `config/balance.gd` — no new constants needed for this story
- `config/constants.gd` — no new constants needed
- Any scene files, UI files — not in scope

### References

- Story requirements: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.3]
- Full class design with exact field names and clamping: [Source: _bmad-output/game-architecture.md#Novel-Pattern-3]
- `@export` on Resource fields rule: [Source: _bmad-output/project-context.md#Resources]
- No magic numbers rule: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- `Balance.SPEED_BASE_INTERVAL`, `Balance.SPEED_STEP`: [Source: config/balance.gd]
- Per-instance rule (never share HeroData): [Source: _bmad-output/project-context.md#Resources]
- `bomb_count` max = 5 (not 10): [Source: _bmad-output/game-architecture.md#Novel-Pattern-3 stat table]
- `clampi()` for integers: [Source: Godot 4.6 API — @GlobalScope.clampi()]
- Existing stub: [Source: src/hero/hero_data.gd — 2 lines, class_name + extends only]
- `nft_cache.gd` return type dependency: [Source: autoloads/nft_cache.gd:3]
- `web3_manager.gd` signal dependency: [Source: autoloads/web3_manager.gd:5]

### Previous Story Intelligence (ST-2.1, ST-2.2 Learnings)

1. **Project parses `JavaScriptObject` type references in non-web builds** — confirmed in ST-2.2. `HeroData` is a plain Resource — no platform guards needed.

2. **`@export var` without default values is valid GDScript 4** — `@export var power: int` (no `= 0`) is fine; Godot initializes `int` to `0` by default. However, since `from_dict()` always sets all fields, defaults don't matter for runtime. The architecture reference shows no default values on the `@export` declarations.

3. **Stub file already has `.uid`** — `src/hero/hero_data.gd.uid` exists. Do NOT delete or recreate it. Modifying `.gd` contents does not invalidate the `.uid`.

4. **`Variant` type annotation used in ST-2.2 for cross-platform safety** — `from_dict()` takes a `Dictionary` parameter (not `Variant`), so no such concern here. Type annotation `Dictionary` is always safe.

5. **No test framework** — confirmed in ST-2.1 and ST-2.2. Use Godot run + debug output for smoke testing only.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test output confirmed `move_interval: 1.3` for speed=7 (expected: 2.0 - 7*0.1 = 1.3 ✅)
- Clamp test output confirmed `power_clamped: 10`, `speed_clamped: 1`, `bomb_count_clamped: 5` ✅

### Completion Notes List

1. **`blast_range` rename**: The story specified `@export var range: int`, but GDScript 4 has a built-in function `range()`. Using `range` as a field name on a Resource triggers a "same name as built-in function" warning. Field renamed to `blast_range`. The `from_dict()` method still reads `data.get("range", 1)` (JSON key unchanged) but stores it in `h.blast_range`. Future stories referencing hero range stat must use `hero.blast_range`, not `hero.range`.

2. **Smoke test approach**: Added `_smoke_test_hero_data()` to `main.gd._ready()` temporarily during dev, verified output via debug log, then removed cleanly. The `main.gd` is restored to its pre-story state.

3. **All ACs verified**:
   - AC1: `class_name HeroData extends Resource` at `src/hero/hero_data.gd` ✅
   - AC2: Six `@export var` fields (token_id, power, speed, stamina, blast_range, bomb_count) ✅
   - AC3: `get_move_interval()` uses `Balance.SPEED_BASE_INTERVAL` and `Balance.SPEED_STEP` ✅
   - AC4: `get_max_bombs()` returns `bomb_count` ✅
   - AC5: `from_dict()` creates new `HeroData` instance ✅
   - AC6: Clamping via `clampi()` for all stats; bomb_count max=5 ✅
   - AC7: `from_dict()` always calls `HeroData.new()` ✅
   - AC8: No `print()` calls, no AppLogger in `from_dict()` ✅

### File List

- `src/hero/hero_data.gd` — modified (stub replaced with full implementation)
