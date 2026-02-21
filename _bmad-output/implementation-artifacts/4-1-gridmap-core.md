# Story 4.1: GridMap Core

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a hero AI,
I want to query GridMap to know which cells are available,
so that heroes don't walk into already-occupied cells.

## Acceptance Criteria

1. `GridMap` node (script `src/map/grid_map.gd`, `class_name GridMap`) manages a Dictionary `{ Vector2i → hero_id }` for occupied cells
2. `GridMap.is_cell_free(cell: Vector2i) -> bool` — returns `true` if cell has no occupant AND is within grid bounds
3. `GridMap.reserve_cell(cell: Vector2i, hero_id: int)` — optimistic reservation (before server confirm)
4. `GridMap.confirm_cell(cell: Vector2i, hero_id: int)` — called after server confirms move; no-op if reservation already matches
5. `GridMap.release_cell(cell: Vector2i, hero_id: int)` — frees the cell; called on move rejection or hero departure; guard: only release if `hero_id` matches current occupant
6. `GridMap.get_free_spawn_cell() -> Vector2i` — returns a random free cell within grid bounds; returns `Vector2i(-1, -1)` if none available
7. Out-of-bounds check: all public methods that accept a `cell` parameter must validate `cell.x >= 0 and cell.x < Constants.GRID_SIZE.x and cell.y >= 0 and cell.y < Constants.GRID_SIZE.y`; log WARN and return early/false on OOB input
8. Chest cells are also tracked as occupied — `GridMap` uses the same Dictionary with a sentinel value (e.g., `-1` for chest) so heroes never path into chest cells

## Tasks / Subtasks

- [x] Task 1: Create `src/map/grid_map.gd` with `class_name GameGrid` (AC: #1)
  - [x] `extends Node`; `class_name GameGrid` (renamed from GridMap — Godot 4 has built-in 3D GridMap node that collides with that name)
  - [x] Declare `var _occupied: Dictionary = {}` — maps `Vector2i → int` (hero_id, or -1 for chest)
  - [x] Add `const CHEST_ID := -1` sentinel constant

- [x] Task 2: Implement bounds-check helper (AC: #7)
  - [x] `func _in_bounds(cell: Vector2i) -> bool` — returns `cell.x >= 0 and cell.x < Constants.GRID_SIZE.x and cell.y >= 0 and cell.y < Constants.GRID_SIZE.y`
  - [x] Used internally by all public methods before any Dictionary access

- [x] Task 3: Implement `is_cell_free(cell: Vector2i) -> bool` (AC: #2, #7)
  - [x] Guard: `if not _in_bounds(cell): AppLogger.warn(...); return false`
  - [x] Return `not _occupied.has(cell)`

- [x] Task 4: Implement `reserve_cell(cell: Vector2i, hero_id: int)` (AC: #3, #7)
  - [x] Guard: OOB → WARN + return
  - [x] If cell already occupied by different id → log WARN (conflict), proceed anyway (optimistic)
  - [x] `_occupied[cell] = hero_id`

- [x] Task 5: Implement `confirm_cell(cell: Vector2i, hero_id: int)` (AC: #4, #7)
  - [x] Guard: OOB → WARN + return
  - [x] If `_occupied.get(cell, -999) == hero_id` → no-op (already reserved correctly)
  - [x] Otherwise → `_occupied[cell] = hero_id` (server is authoritative)

- [x] Task 6: Implement `release_cell(cell: Vector2i, hero_id: int)` (AC: #5, #7)
  - [x] Guard: OOB → WARN + return
  - [x] Guard: if `_occupied.get(cell, -999) != hero_id` → log WARN "release_cell mismatch", return (do not release another hero's cell)
  - [x] `_occupied.erase(cell)`

- [x] Task 7: Implement `get_free_spawn_cell() -> Vector2i` (AC: #6)
  - [x] Build candidate list: all cells `(x, y)` where `x in range(Constants.GRID_SIZE.x)` and `y in range(Constants.GRID_SIZE.y)` and `not _occupied.has(Vector2i(x, y))`
  - [x] If candidates empty: `AppLogger.warn("GameGrid", "No free spawn cells available"); return Vector2i(-1, -1)`
  - [x] Return `candidates[randi() % candidates.size()]`

- [x] Task 8: Add chest occupancy helpers (AC: #8)
  - [x] `func mark_chest_cell(cell: Vector2i)` — `_occupied[cell] = CHEST_ID`
  - [x] `func unmark_chest_cell(cell: Vector2i)` — `_occupied.erase(cell)` (only if value is CHEST_ID)
  - [x] These are called by Chest node (ST-4.3) when chest spawns/destroys

- [x] Task 9: Attach script to scene and smoke test (AC: all)
  - [x] Create `scenes/treasure_hunt/grid_map.tscn` with root Node → attached `src/map/grid_map.gd`
  - [x] Smoke test: add temporary calls in `main.gd._ready()` to verify key paths compile and behave
  - [x] Remove smoke test after verification

## Dev Notes

### What This Story Does

Implements **`GridMap`** — the grid state authority on the client side. This is a pure data/logic node: no rendering, no physics, no `_process()`. It tracks which cells are occupied by which hero (or by a chest), and exposes query methods that `HeroAI` calls before every move decision.

**This story creates ONE new file:**
- `src/map/grid_map.gd` — the GridMap script

**And ONE new scene:**
- `scenes/treasure_hunt/grid_map.tscn` — instantiated inside `treasure_hunt.tscn` (wired up in later stories)

GridMap does **NOT** render anything — that is ST-4.2's job. GridMap is purely a data structure.

### Architecture Pattern: Server-Authoritative Idle Loop

GridMap is the client-side occupancy mirror in the server-authoritative idle loop (Game Architecture, Novel Pattern 1):

```
HeroAI timer fires
  → GridMap.is_cell_free(target) — local query
  → GridMap.reserve_cell(target, hero_id) — optimistic
  → ServerAPI.send_move_intent(hero_id, target)
  → Server replies:
      hero_move_confirmed → GridMap.confirm_cell(target, hero_id)
      hero_move_rejected  → GridMap.release_cell(reserved_cell, hero_id)
```

**Optimistic reservation:** `reserve_cell` is called immediately on the client before the server confirms. This prevents two heroes from simultaneously targeting the same cell in the same frame. The server is still authoritative — `release_cell` corrects the state if server rejects.

### CRITICAL: Dictionary Key — Vector2i

Godot 4 `Dictionary` supports `Vector2i` as keys natively. This is the correct pattern:

```gdscript
var _occupied: Dictionary = {}

# Store
_occupied[Vector2i(3, 7)] = 1  # hero_id 1 occupies cell (3,7)

# Query
if _occupied.has(Vector2i(3, 7)):
    var occupant_id: int = _occupied[Vector2i(3, 7)]

# Delete
_occupied.erase(Vector2i(3, 7))
```

**DO NOT** encode `Vector2i` as a String key (`"3_7"`) — this is unnecessary in Godot 4 and slower.

### CRITICAL: Constants.GRID_SIZE

`Constants.GRID_SIZE` is already declared in `config/constants.gd`:

```gdscript
class_name Constants
const GRID_SIZE := Vector2i(20, 15)   # 20 columns × 15 rows
const MAX_HEROES := 15
const BOMB_RADIUS := 1
```

**Access pattern:** `Constants.GRID_SIZE.x` (columns), `Constants.GRID_SIZE.y` (rows).

All bounds checks must use `Constants.GRID_SIZE` — never hardcode `20` or `15`.

### CRITICAL: Chest Sentinel Value

Chests also occupy grid cells and must block hero movement. The same `_occupied` dictionary is used with `CHEST_ID = -1` as a sentinel:

```gdscript
const CHEST_ID := -1

func mark_chest_cell(cell: Vector2i) -> void:
    if not _in_bounds(cell):
        AppLogger.warn("GridMap", "mark_chest_cell OOB", {"cell": cell})
        return
    _occupied[cell] = CHEST_ID

func unmark_chest_cell(cell: Vector2i) -> void:
    if _occupied.get(cell) == CHEST_ID:
        _occupied.erase(cell)
```

`is_cell_free()` returning `not _occupied.has(cell)` already blocks both hero cells AND chest cells — no extra logic needed there.

### CRITICAL: release_cell Guard — Prevent Cross-Hero Corruption

The release guard is essential for correctness:

```gdscript
func release_cell(cell: Vector2i, hero_id: int) -> void:
    if not _in_bounds(cell):
        AppLogger.warn("GridMap", "release_cell OOB", {"cell": cell, "hero_id": hero_id})
        return
    if _occupied.get(cell, -999) != hero_id:
        AppLogger.warn("GridMap", "release_cell mismatch — cell owned by different id",
            {"cell": cell, "hero_id": hero_id, "actual": _occupied.get(cell, "empty")})
        return
    _occupied.erase(cell)
```

If `hero_id` doesn't match the stored value, another hero (or a chest) owns that cell. Releasing it would corrupt the grid state and cause two heroes to overlap.

### CRITICAL: get_free_spawn_cell() — Random Shuffle Approach

Build the candidate list and pick randomly:

```gdscript
func get_free_spawn_cell() -> Vector2i:
    var candidates: Array[Vector2i] = []
    for x in range(Constants.GRID_SIZE.x):
        for y in range(Constants.GRID_SIZE.y):
            var cell := Vector2i(x, y)
            if not _occupied.has(cell):
                candidates.append(cell)
    if candidates.is_empty():
        AppLogger.warn("GridMap", "No free spawn cells available")
        return Vector2i(-1, -1)
    return candidates[randi() % candidates.size()]
```

`randi()` is a global Godot 4 function — no `RandomNumberGenerator` instance needed for this simple use case.

### confirm_cell vs reserve_cell

These two methods have distinct semantics:

| Method | When called | What it does |
|---|---|---|
| `reserve_cell` | Immediately on HeroAI tick (before server reply) | Optimistic — marks intent |
| `confirm_cell` | On `hero_move_confirmed` signal from server | Authoritative — server approved |

In the normal flow, `confirm_cell` is a no-op because `reserve_cell` already set the value. It becomes meaningful only if a race condition somehow changes the cell between reserve and confirm (e.g., another system modified the dictionary).

### Node Type

`GridMap` extends `Node` (not `Node2D`) — it has no visual representation. It is instantiated as a child of the `TreasureHunt` scene and accessed by name or via a reference injected into `HeroAI`.

```gdscript
# In treasure_hunt.gd (ST-5.x):
@onready var grid_map: GridMap = $GridMap
```

`HeroAI` will receive a reference to `GridMap` at spawn time (injected via `HeroFactory.create()` in ST-5.x) — it does NOT call `get_node()` on its own.

### No _process(), No Signals

`GridMap` has **no `_process()`** and **no signals**. It is a pure state container queried synchronously by callers. This keeps it simple and deterministic — no timing dependencies.

### Smoke Test Approach

Add a temporary block to `src/core/main.gd._ready()` (inside `OS.is_debug_build()`) to verify:

```gdscript
# Temporary smoke test
var gm := GridMap.new()
add_child(gm)
assert(gm.is_cell_free(Vector2i(0, 0)) == true, "fresh cell should be free")
gm.reserve_cell(Vector2i(0, 0), 1)
assert(gm.is_cell_free(Vector2i(0, 0)) == false, "reserved cell not free")
gm.release_cell(Vector2i(0, 0), 1)
assert(gm.is_cell_free(Vector2i(0, 0)) == true, "released cell free again")
var spawn := gm.get_free_spawn_cell()
assert(spawn != Vector2i(-1, -1), "spawn cell found on empty grid")
# OOB test
assert(gm.is_cell_free(Vector2i(-1, 0)) == false, "OOB should return false")
assert(gm.is_cell_free(Vector2i(99, 99)) == false, "OOB should return false")
gm.queue_free()
AppLogger.info("Main", "GridMap smoke test passed")
```

Remove this block after verification.

### Scope Boundary

| Feature | Story |
|---|---|
| Grid visual rendering (tiles) | ST-4.2 |
| Chest node instantiation | ST-4.3 |
| Chest spawning from server | ST-4.4 |
| HeroAI calling GridMap | ST-5.3/5.4 |
| TreasureHunt wiring GridMap into scene | ST-5.1/5.3 |

### Key Learnings from ST-3.x / Earlier Series

- Use `class_name` at the top of the file for static access
- `AppLogger.warn("GridMap", "message", {dict_data})` — always include system name
- No magic numbers — use `Constants.GRID_SIZE`
- Keep methods short, single-responsibility
- `_reset_http()` pattern: always reset ALL state vars consistently — apply same rigor to any future reset-like method

### References

- Epic requirements: [Source: _bmad-output/epics/epic-4-grid-map-chest.md#ST-4.1]
- `Constants.GRID_SIZE`: [Source: config/constants.gd:3]
- Architecture Novel Pattern 1 (Server-Authoritative Idle Loop): [Source: _bmad-output/game-architecture.md#Novel-Pattern-1]
- GridMap location: [Source: _bmad-output/game-architecture.md#System-Location-Mapping] — `src/map/grid_map.gd`
- Autoload boundary rules: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- No magic numbers rule: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- Signal connect/disconnect rules: [Source: _bmad-output/project-context.md#Signals]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test first run: `Parser Error: Cannot infer the type of "spawn" variable` — fixed with explicit `var spawn: Vector2i` annotation
- Smoke test second run: `Invalid call. Nonexistent function 'is_cell_free' in base 'GridMap'` — Godot 4 built-in 3D `GridMap` node class name collision; renamed to `GameGrid`
- Smoke test third run (final): `[INFO] [Main] GridMap smoke test passed` ✅
- Expected WARNs fired correctly: `release_cell mismatch`, `is_cell_free OOB (-1,0)`, `is_cell_free OOB (99,99)` — all assertions passed
- No parse errors ✅

### Completion Notes List

1. **`class_name GameGrid`** — renamed from `GridMap` to avoid collision with Godot 4's built-in 3D `GridMap` node. The story's AC#1 referenced `class_name GridMap` but the engine's built-in takes precedence, causing `GameGrid.new()` to instantiate the 3D engine node instead of our script. `GameGrid` is the canonical name for future stories.

2. **`_occupied: Dictionary`** — maps `Vector2i → int`. Key is cell coordinate, value is `hero_id` (≥0) or `CHEST_ID` (-1). A missing key means free. Godot 4 supports `Vector2i` as Dictionary keys natively.

3. **`_in_bounds(cell)`** — private bounds helper used by all 6 public methods. Guards against negative coords and coords ≥ `Constants.GRID_SIZE`. Returns `false` on OOB so callers safely short-circuit.

4. **`reserve_cell` conflict WARN** — if a cell is already occupied by a different hero when reserve is called, logs WARN but proceeds (optimistic reservation). The server will reject the conflicting move.

5. **`confirm_cell` no-op pattern** — uses sentinel `-999` (outside valid id range) to distinguish "not present" from `CHEST_ID (-1)` or any `hero_id (≥0)`. No-ops when reservation already matches.

6. **`release_cell` mismatch guard** — verifies `_occupied.get(cell, -999) == hero_id` before erasing. Prevents cross-hero dictionary corruption. Smoke test verified: wrong hero_id call logs WARN and leaves cell occupied.

7. **`get_free_spawn_cell()`** — builds full candidate list then `randi() % size`. Uses typed `Array[Vector2i]` for the candidates array.

8. **Chest helpers** — `mark_chest_cell` / `unmark_chest_cell` use the same `_occupied` dict with `CHEST_ID = -1`. `is_cell_free()` blocks chest cells automatically since the key exists.

9. **AC verification**:
   - AC1: `GameGrid` (renamed), `_occupied: Dictionary`, `CHEST_ID` const ✅
   - AC2: `is_cell_free()` returns `not _occupied.has(cell)` with OOB guard ✅
   - AC3: `reserve_cell()` with OOB guard + conflict WARN ✅
   - AC4: `confirm_cell()` with OOB guard + no-op on match ✅
   - AC5: `release_cell()` with OOB guard + hero_id mismatch guard ✅
   - AC6: `get_free_spawn_cell()` returns random free cell or `(-1,-1)` ✅
   - AC7: OOB check in all 6 public methods — WARN + return ✅
   - AC8: `mark_chest_cell` / `unmark_chest_cell` — chest cells block heroes ✅

### File List

- `src/map/grid_map.gd` — created (class_name GameGrid, all 8 AC methods)
- `scenes/treasure_hunt/grid_map.tscn` — created (Node root with grid_map.gd script)
- `src/core/main.gd` — modified (smoke test added and removed — net clean)
- `src/map/grid_map.gd.uid` — auto-generated by Godot 4.4+ (sidecar UID file)

## Code Review Record

### Reviewer Model

claude-sonnet-4-6

### Review Date

2026-02-21

### Issues Found

- M1 (fixed): `confirm_cell` silently overwrote chest cells — no conflict WARN before server-authoritative overwrite. Added `_occupied.has(cell)` check + WARN log before writing.
- M2 (fixed): `scenes/treasure_hunt/grid_map.tscn` had invalid hand-crafted UID `uid://gamegrid_scene`. Removed `uid=` attribute so Godot assigns a valid UID on next editor save.
- M3 (fixed): `_occupied` was untyped `Dictionary`. Changed to `Dictionary[Vector2i, int]` for Godot 4.6 static analysis.
- L1 (fixed): Magic sentinel `-999` used inline in `confirm_cell` and `release_cell`. Extracted to named constant `_ABSENT := -999` with doc comment explaining its valid range.
- L2 (fixed): `src/map/grid_map.gd.uid` not documented in File List. Added above.

### Fixes Applied

1. Added `const _ABSENT := -999` constant alongside `CHEST_ID`
2. Typed `_occupied` as `Dictionary[Vector2i, int]`
3. `confirm_cell`: added conflict WARN when overwriting an existing occupant (server-authoritative write still proceeds)
4. `confirm_cell` + `release_cell`: replaced inline `-999` with `_ABSENT`
5. `grid_map.tscn`: removed invalid `uid="uid://gamegrid_scene"` from scene header
6. File List updated with `.uid` sidecar
