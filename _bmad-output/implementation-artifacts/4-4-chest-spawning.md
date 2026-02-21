# Story 4.4: Chest Spawning

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the game,
I want chests to be spawned on the grid based on server commands,
so that the client never decides which chests appear — the server is always authoritative.

## Acceptance Criteria

1. `ServerAPI` declares `signal chest_spawned(cell: Vector2i)` — emitted when a `"chest_spawned"` WebSocket message arrives with a valid `cell` field
2. `ServerAPI._handle_server_message()` handles `"chest_spawned"` message type: validates `x` and `y` fields exist → emits `chest_spawned(Vector2i(x, y))`
3. A new scene `scenes/treasure_hunt/treasure_hunt.tscn` exists with root `Node2D` named `TreasureHunt`, script `src/map/treasure_hunt.gd` attached
4. `TreasureHunt` (`src/map/treasure_hunt.gd`) holds references to a `GameGrid` child node and a `GridVisual` child node (injected via `@onready`)
5. `TreasureHunt` connects to `ServerAPI.chest_spawned` in `_ready()` and disconnects in `_exit_tree()`
6. On `chest_spawned(cell)`: if `game_grid.is_cell_free(cell)` → instantiate `chest.tscn`, `add_child(chest)`, call `chest.initialize(cell, game_grid, grid_visual)`, log INFO
7. On `chest_spawned(cell)` where cell is NOT free: log WARN, find the nearest free cell via `game_grid.get_free_spawn_cell()`, spawn there instead; if no free cell exists, log ERROR and drop the spawn
8. `TreasureHunt` uses `preload("res://scenes/treasure_hunt/chest.tscn")` (compile-time) not `load()` (runtime) — as per architecture performance rules
9. Client never calls `chest_spawned` itself — it only receives and reacts. No local chest spawn logic outside the signal handler.
10. Smoke test: Temporarily trigger `ServerAPI.chest_spawned.emit(Vector2i(3, 3))` from `main.gd` to verify a Chest appears; restore `main.gd` after verification.

## Tasks / Subtasks

- [x] Task 1: Add `chest_spawned` signal to `ServerAPI` (AC: #1)
  - [x] Declare `signal chest_spawned(cell: Vector2i)` in `autoloads/server_api.gd` with the existing signal block
  - [x] In `_handle_server_message()`, add `"chest_spawned"` case to the `match type:` block
  - [x] Validate `data.has_all(["x", "y"])` — if missing, log WARN and return
  - [x] Emit `chest_spawned.emit(Vector2i(data["x"], data["y"]))`

- [x] Task 2: Create `src/map/treasure_hunt.gd` (AC: #3, #4, #5, #6, #7, #8, #9)
  - [x] `class_name TreasureHunt` extends `Node2D`
  - [x] `@onready var _game_grid: GameGrid = $GameGrid`
  - [x] `@onready var _grid_visual: GridVisual = $GridVisual`
  - [x] `const _CHEST_SCENE = preload("res://scenes/treasure_hunt/chest.tscn")`
  - [x] `func _ready()`: connect `ServerAPI.chest_spawned` to `_on_chest_spawned`
  - [x] `func _exit_tree()`: guard + disconnect `ServerAPI.chest_spawned`
  - [x] `func _on_chest_spawned(cell: Vector2i)`: implement spawn logic with free-cell fallback

- [x] Task 3: Create `scenes/treasure_hunt/treasure_hunt.tscn` (AC: #3, #4)
  - [x] Root: `Node2D` named `TreasureHunt`, script `res://src/map/treasure_hunt.gd`
  - [x] Child: `Node` named `GameGrid`, script `res://src/map/grid_map.gd`
  - [x] Child: `Node2D` named `GridVisual`, script `res://src/map/grid_visual.gd`
  - [x] No other children needed — `Chest` nodes are added dynamically at runtime

- [x] Task 4: Smoke test (AC: #10)
  - [x] Edit `scenes/main.tscn`: add `TreasureHunt` as a child of Main (reference `scenes/treasure_hunt/treasure_hunt.tscn`)
  - [x] Edit `src/core/main.gd`: inside `OS.is_debug_build()` block, after scene is ready, emit `ServerAPI.chest_spawned.emit(Vector2i(3, 3))`
  - [x] Run project — verify `[INFO] [TreasureHunt] Chest spawned` appears in output AND chest appears at correct pixel position
  - [x] Stop project, restore `main.tscn` and `main.gd` to clean state

## Dev Notes

### What This Story Does

Implements **`TreasureHunt`** — the scene that owns the grid and listens for `ServerAPI.chest_spawned` to instantiate `Chest` nodes dynamically. This is the wiring layer between the server protocol (Epic 3) and the visual chest system (ST-4.3).

**This story modifies ONE existing file:**
- `autoloads/server_api.gd` — adds `chest_spawned` signal declaration + message handler

**And creates TWO new files:**
- `src/map/treasure_hunt.gd` — spawner script
- `scenes/treasure_hunt/treasure_hunt.tscn` — scene with GameGrid + GridVisual + dynamic Chest children

### CRITICAL: `chest_spawned` Signal Not Yet in `ServerAPI`

`ServerAPI` currently handles: `hero_move_confirmed`, `hero_move_rejected`, `bomb_validated`, `stamina_updated`, `reward_received`. The `"chest_spawned"` message type is NOT yet handled — it falls through to the `_:` WARN case.

**Exact location to add** in `autoloads/server_api.gd`:

Signal declaration (add after `connection_lost` signal, before `http_response_received`):
```gdscript
signal chest_spawned(cell: Vector2i)
```

Handler case (add inside `_handle_server_message()` match block, before the `_:` default):
```gdscript
"chest_spawned":
    if not data.has_all(["x", "y"]):
        AppLogger.warn("ServerAPI", "chest_spawned missing fields", {"data": data})
        return
    chest_spawned.emit(Vector2i(data["x"], data["y"]))
```

### CRITICAL: `TreasureHunt` Scene Node Hierarchy

The `treasure_hunt.tscn` must have `GameGrid` and `GridVisual` as direct children of the root so `@onready` references resolve correctly:

```
TreasureHunt (Node2D) ← root, script: src/map/treasure_hunt.gd
├── GameGrid (Node)   ← script: src/map/grid_map.gd
└── GridVisual (Node2D) ← script: src/map/grid_visual.gd
```

`Chest` nodes are **NOT** in the scene file — they are instantiated at runtime via `_on_chest_spawned()` and added with `add_child()`.

### CRITICAL: `preload` vs `load` for Chest Scene

Per architecture performance rules (`project-context.md` — Asset Loading section):
> Use `preload()` for scenes and resources known at compile time (hero scene, bomb scene, chest scene)

```gdscript
# CORRECT — compile-time preload
const _CHEST_SCENE = preload("res://scenes/treasure_hunt/chest.tscn")

# WRONG — runtime load (slower, defeats caching)
var scene = load("res://scenes/treasure_hunt/chest.tscn")
```

### CRITICAL: Spawn Logic with Free-Cell Fallback

The epic AC states: "Nếu cell đã có hero: log WARN (server side bug), đặt chest ở cell gần nhất trống". Implement as:

```gdscript
func _on_chest_spawned(cell: Vector2i) -> void:
    var target_cell := cell
    if not _game_grid.is_cell_free(cell):
        AppLogger.warn("TreasureHunt", "chest_spawned cell occupied — finding fallback",
            {"requested": cell})
        target_cell = _game_grid.get_free_spawn_cell()
        if target_cell == Vector2i(-1, -1):
            AppLogger.error("TreasureHunt", "No free cell for chest spawn — dropping")
            return
    var chest := _CHEST_SCENE.instantiate() as Chest
    add_child(chest)
    chest.initialize(target_cell, _game_grid, _grid_visual)
    AppLogger.info("TreasureHunt", "Chest spawned", {"cell": target_cell})
```

Note: `get_free_spawn_cell()` returns `Vector2i(-1, -1)` when the grid is completely full — always check for this sentinel before proceeding.

### CRITICAL: Signal Disconnect with `is_connected()` Guard

Following the pattern established in ST-4.3 (code review fix M2):

```gdscript
func _exit_tree() -> void:
    if ServerAPI.chest_spawned.is_connected(_on_chest_spawned):
        ServerAPI.chest_spawned.disconnect(_on_chest_spawned)
```

This prevents a runtime error if the node is freed before entering the scene tree.

### CRITICAL: `class_name` — `TreasureHunt` is Safe

`TreasureHunt` is not a Godot built-in class name. Safe to use as `class_name TreasureHunt`. (Recall from ST-4.1: `GridMap` conflicts with the Godot 3D built-in → was renamed to `GameGrid`.)

### CRITICAL: godot-mcp Headless Limitation

`add_node` via godot-mcp fails in headless mode when scenes reference autoloads (AppLogger, ServerAPI etc.). **Use direct `.tscn` file editing for the scene and smoke test** — the established pattern from ST-4.2 and ST-4.3.

For the smoke test, the emit call should be deferred to allow `_ready()` to complete before the signal fires:

```gdscript
# main.gd — smoke test only, remove after verification
func _ready() -> void:
    ...
    if OS.is_debug_build():
        ...
        # Smoke test: trigger chest spawn after scene is ready
        await get_tree().process_frame
        ServerAPI.chest_spawned.emit(Vector2i(3, 3))
```

Using `await get_tree().process_frame` ensures `TreasureHunt._ready()` (which connects to `chest_spawned`) has fired before the emit.

### CRITICAL: `treasure_hunt.tscn` Direct Editing

Since godot-mcp headless can't reliably build this scene, create `scenes/treasure_hunt/treasure_hunt.tscn` directly:

```
[gd_scene format=3]

[ext_resource type="Script" uid="uid://..." path="res://src/map/treasure_hunt.gd" id="1"]
[ext_resource type="Script" uid="uid://..." path="res://src/map/grid_map.gd" id="2"]
[ext_resource type="Script" uid="uid://..." path="res://src/map/grid_visual.gd" id="3"]

[node name="TreasureHunt" type="Node2D"]
script = ExtResource("1")

[node name="GameGrid" type="Node" parent="."]
script = ExtResource("2")

[node name="GridVisual" type="Node2D" parent="."]
script = ExtResource("3")
```

Use actual UIDs from the `.uid` sidecar files:
- `src/map/grid_map.gd.uid` → UID for GameGrid script
- `src/map/grid_visual.gd.uid` → UID for GridVisual script
- `src/map/treasure_hunt.gd.uid` → UID for TreasureHunt script (generated after file creation)

### Coordinate Contract (Established ST-4.2)

`GridVisual.cell_to_pixel(cell)` returns top-left corner. `Chest.initialize()` adds `tile_size / 2` internally to center the sprite. `TreasureHunt` does NOT need to offset — just pass `cell` as-is to `chest.initialize()`.

### Scope Boundary

| Feature | Story |
|---|---|
| Grid cell occupancy tracking | ST-4.1 (done) |
| Grid visual rendering | ST-4.2 (done) |
| Chest visual + destroy animation | ST-4.3 (done) |
| **Chest spawning from server signal** | **ST-4.4 (this story)** |
| Hero spawning + AI loop | ST-5.x |

### Key Learnings from ST-4.1 → ST-4.3

- `is_connected()` guard in `_exit_tree()` before `disconnect()` — prevents error on premature free (code review M2 fix)
- `connect()` before `play()` when signals and animations interact — prevents timing race (code review M1 fix)
- Animations created in `_setup_animations()` in GDScript, not raw `.tscn` keyframes
- `.uid` sidecar files exist for all `.gd` scripts — reference them in `.tscn` ext_resource entries
- `await get_tree().process_frame` to defer signals past `_ready()` in smoke tests
- Direct `.tscn` editing more reliable than godot-mcp for scenes with autoloads

### References

- Epic requirements: [Source: _bmad-output/epics/epic-4-grid-map-chest.md#ST-4.4]
- `ServerAPI._handle_server_message`: [Source: autoloads/server_api.gd:221]
- `ServerAPI` signal block: [Source: autoloads/server_api.gd:3-11]
- `GameGrid.is_cell_free`: [Source: src/map/grid_map.gd:16]
- `GameGrid.get_free_spawn_cell`: [Source: src/map/grid_map.gd:62]
- `Chest.initialize` signature: [Source: src/map/chest.gd:23]
- `GridVisual.tile_size` / `cell_to_pixel`: [Source: src/map/grid_visual.gd:9,30]
- `preload()` vs `load()` rule: [Source: _bmad-output/project-context.md#Asset-Loading]
- Signal connect/disconnect rules: [Source: _bmad-output/project-context.md#Godot-4.x-Engine-Rules]
- Architecture — TreasureHunt scene location: [Source: _bmad-output/game-architecture.md#Directory-Structure] → `scenes/treasure_hunt/treasure_hunt.tscn`
- Architecture — no magic numbers: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- ST-4.3 `is_connected()` guard pattern: [Source: _bmad-output/implementation-artifacts/4-3-chest-node.md#Debug-Log]
- ST-4.3 smoke test pattern (deferred emit): [Source: _bmad-output/implementation-artifacts/4-3-chest-node.md#Dev-Notes]

## Dev Agent Record

### Agent Model Used

claude-haiku-4-5

### Debug Log References

- `[INFO] [Chest] Chest initialized — { "cell": (3, 3) }` ✅
- `[INFO] [TreasureHunt] Chest spawned — { "cell": (3, 3) }` ✅
- Smoke test verified dynamic instantiation and initialization of Chest nodes via ServerAPI signals.
- Handled fallback logic for occupied cells using `GameGrid.get_free_spawn_cell()`.

### Completion Notes List

- Implemented `TreasureHunt` scene and script as the central coordinator for the grid-based gameplay.
- Added `chest_spawned` signal to `ServerAPI` and updated the WebSocket message parser.
- Ensured strict adherence to architecture rules: `preload()` for scenes, `is_connected()` guards in `_exit_tree()`, and no magic numbers.
- Verified coordinate contract: `TreasureHunt` passes raw cell coordinates, `Chest` handles visual centering.

### File List

- `autoloads/server_api.gd` (modified)
- `src/map/treasure_hunt.gd` (created)
- `src/map/treasure_hunt.gd.uid` (created)
- `scenes/treasure_hunt/treasure_hunt.tscn` (created)

