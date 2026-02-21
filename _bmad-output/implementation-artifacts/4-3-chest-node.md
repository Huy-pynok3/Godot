# Story 4.3: Chest Node

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see chests appear on the grid and animate when destroyed,
so that I have visual feedback when heroes earn rewards.

## Acceptance Criteria

1. `Chest` node (`src/map/chest.gd`, `class_name Chest`) extends `Node2D`
2. Chest has a `Sprite2D` child and an `AnimationPlayer` child with two animations: `idle` and `destroy`
3. `Chest.initialize(cell: Vector2i, game_grid: GameGrid, grid_visual: GridVisual)` — sets up the chest at the given cell; positions it visually using `grid_visual.cell_to_pixel(cell) + grid_visual.tile_size / 2`; calls `game_grid.mark_chest_cell(cell)` to block heroes
4. Chest connects to `ServerAPI.bomb_validated` in `_ready()` and disconnects in `_exit_tree()`
5. When `bomb_validated(hero_id, position, chest_destroyed)` fires: if `position == _cell` AND `chest_destroyed == true` → play `destroy` animation → call `game_grid.unmark_chest_cell(_cell)` → `queue_free()` after animation completes
6. If `bomb_validated` fires at this cell but `chest_destroyed == false` → no visual change (chest survives hit)
7. Multiple `Chest` instances can coexist simultaneously — each manages only its own cell
8. Scene at `scenes/treasure_hunt/chest.tscn` with root `Node2D` → `Sprite2D` child + `AnimationPlayer` child; script `src/map/chest.gd` attached to root
9. Placeholder sprite: use a solid yellow `ColorRect`-style fill on the `Sprite2D` via a `PlaceholderTexture2D` (or a 1×1 white pixel with modulate set to yellow) — no external art required
10. `destroy` animation duration: 0.5 seconds; after animation `animation_finished` signal → `queue_free()`

## Tasks / Subtasks

- [x] Task 1: Create `src/map/chest.gd` with `class_name Chest` (AC: #1)
  - [x] `extends Node2D`; `class_name Chest`
  - [x] Declare `var _cell: Vector2i` — set in `initialize()`
  - [x] Declare `var _game_grid: GameGrid` — injected reference
  - [x] Declare `@onready var _anim: AnimationPlayer = $AnimationPlayer` (note: `_sprite` not needed as script var)
  - [x] Declare `var _initialized: bool = false`

- [x] Task 2: Implement `initialize(cell: Vector2i, game_grid: GameGrid, grid_visual: GridVisual)` (AC: #3)
  - [x] Store `_cell = cell`, `_game_grid = game_grid`
  - [x] `position = grid_visual.cell_to_pixel(cell) + grid_visual.tile_size / 2`
  - [x] `game_grid.mark_chest_cell(cell)`
  - [x] `AppLogger.info("Chest", "Chest initialized", {"cell": cell})`

- [x] Task 3: Implement signal connect/disconnect (AC: #4)
  - [x] In `_ready()`: `ServerAPI.bomb_validated.connect(_on_bomb_validated)`
  - [x] In `_exit_tree()`: `ServerAPI.bomb_validated.disconnect(_on_bomb_validated)`

- [x] Task 4: Implement `_on_bomb_validated(hero_id: int, bomb_position: Vector2i, chest_destroyed: bool)` (AC: #5, #6)
  - [x] If `not _initialized`: return (guard against race between add_child and initialize)
  - [x] If `bomb_position != _cell`: return (not our cell)
  - [x] If `not chest_destroyed`: return (chest survived — no visual change)
  - [x] `_game_grid.unmark_chest_cell(_cell)`
  - [x] `_anim.play("destroy")`
  - [x] `AppLogger.info("Chest", "Chest destroyed", {"cell": _cell, "hero_id": hero_id})`
  - [x] Connect `_anim.animation_finished` to `_on_destroy_animation_finished` with `CONNECT_ONE_SHOT`

- [x] Task 5: Implement `_on_destroy_animation_finished(anim_name: StringName)` (AC: #10)
  - [x] If `anim_name == "destroy"`: `queue_free()`

- [x] Task 6: Create `scenes/treasure_hunt/chest.tscn` (AC: #8, #9)
  - [x] Root: `Node2D` named `Chest`, script `res://src/map/chest.gd`
  - [x] Child: `Sprite2D` named `Sprite2D`
  - [x] Child: `AnimationPlayer` named `AnimationPlayer`
  - [x] Sprite2D: `texture = PlaceholderTexture2D` (size 32×32), `modulate = Color(1, 0.8, 0)` (gold/yellow)
  - [x] Animations created programmatically via `_setup_animations()` in `_ready()` (more reliable than .tscn keyframe encoding)

- [x] Task 7: Smoke test (AC: all)
  - [x] Added `GameGrid`, `GridVisual`, `Chest` nodes temporarily to `main.tscn`
  - [x] Called `chest.initialize(Vector2i(5, 5), game_grid, grid_visual)` in `main.gd._ready()`
  - [x] Run result: `[INFO] [Chest] Chest initialized — { "cell": (5, 5) }` ✅, no warnings
  - [x] Removed all temporary additions — `main.tscn` and `main.gd` restored to clean state

## Dev Notes

### What This Story Does

Implements **`Chest`** — a visual Node2D that represents a treasure chest on the grid. It listens to `ServerAPI.bomb_validated` and destroys itself (with animation) when the server confirms its cell was hit.

**This story creates ONE new file:**
- `src/map/chest.gd` — the Chest script

**And ONE new scene:**
- `scenes/treasure_hunt/chest.tscn` — instantiated by TreasureHunt scene in ST-4.4

### CRITICAL: initialize() Must Be Called Before _ready() Connections Are Live

`initialize()` is called by the spawner (TreasureHunt in ST-4.4) **after** `add_child()`. The sequence is:

```
chest = chest_scene.instantiate()
add_child(chest)          ← _ready() fires here, signal connected
chest.initialize(...)     ← position set, GameGrid marked AFTER _ready()
```

This means `ServerAPI.bomb_validated` is connected in `_ready()` BEFORE `initialize()` sets `_cell`. If `bomb_validated` fires between `add_child()` and `initialize()` completing (extremely unlikely, but possible), `_cell` is `Vector2i(0,0)` (default). Guard `_on_bomb_validated` against this: check `_cell != Vector2i(0, 0)` OR use a `_initialized: bool` flag.

**Use `_initialized` flag approach:**

```gdscript
var _initialized: bool = false

func initialize(...) -> void:
    ...
    _initialized = true

func _on_bomb_validated(...) -> void:
    if not _initialized:
        return
    ...
```

### CRITICAL: animation_finished Connection — Avoid Multiple Connects

`animation_finished` must NOT be connected in `_ready()`. It should only be connected **once, inside `_on_bomb_validated`**, when the destroy animation actually starts. Use a one-shot approach:

```gdscript
func _on_bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool) -> void:
    if not _initialized or position != _cell or not chest_destroyed:
        return
    _game_grid.unmark_chest_cell(_cell)
    _anim.play("destroy")
    AppLogger.info("Chest", "Chest destroyed", {"cell": _cell, "hero_id": hero_id})
    _anim.animation_finished.connect(_on_destroy_animation_finished, CONNECT_ONE_SHOT)
```

`CONNECT_ONE_SHOT` (Godot 4 flag) automatically disconnects after first call — no manual cleanup needed.

### CRITICAL: ServerAPI signal signature

`ServerAPI.bomb_validated` is declared as:
```gdscript
signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
```
The position parameter is the **bomb position** (where the hero placed the bomb), which equals the chest's cell if it was hit. Each `Chest` instance compares `position == _cell` to filter its own events.

### CRITICAL: PlaceholderTexture2D for Sprite2D

Godot 4 has `PlaceholderTexture2D` — a built-in resource that creates a colored placeholder rectangle. Set it on `Sprite2D.texture`:

```gdscript
# In scene file or via script if needed:
var tex := PlaceholderTexture2D.new()
tex.size = Vector2(32, 32)
$Sprite2D.texture = tex
$Sprite2D.modulate = Color(1, 0.8, 0)  # Gold/yellow
```

The `PlaceholderTexture2D` renders as a solid rectangle. Combined with `modulate`, the chest appears as a yellow box on the grid.

**Sprite2D centering:** `Sprite2D` is centered by default (`centered = true`) — so `position = cell_to_pixel(cell) + tile_size / 2` correctly centers it in the cell.

### CRITICAL: AnimationPlayer Setup in Scene

The `destroy` animation should animate `Sprite2D:modulate:a` (alpha channel) from 1.0 to 0.0 over 0.5 seconds. This creates a simple fade-out effect without needing art:

- Track type: `Property`
- Node path: `Sprite2D`
- Property: `modulate:a`
- Keyframe at 0.0s: value `1.0`
- Keyframe at 0.5s: value `0.0`
- Loop: OFF, one-shot

The `idle` animation can be an empty animation (length 1.0s, loop ON) — just a placeholder to set as autoplay so AnimationPlayer is always running.

Creating animations via godot-mcp or `.tscn` direct editing is complex. **Use the `_ready()` workaround:** create and register both animations via GDScript in `_ready()` if the `.tscn` approach proves too verbose.

### CRITICAL: Cell `Vector2i(0, 0)` Is a Valid Cell

Do NOT use `Vector2i(0, 0)` as the "uninitialized" sentinel — it is a valid grid cell (top-left corner). Use the `_initialized: bool` flag instead.

### Coordinate Contract (from ST-4.2)

```gdscript
# Center Chest sprite in its cell:
position = grid_visual.cell_to_pixel(_cell) + grid_visual.tile_size / 2
```

`cell_to_pixel` returns top-left corner; adding `tile_size / 2` centers the sprite. This is the established contract from ST-4.2 — all visual nodes use it.

### godot-mcp Limitation (from ST-4.1, ST-4.2)

`godot-mcp`'s `add_node` fails in headless mode when the scene uses autoloads. Use direct `.tscn` file editing instead (as done in ST-4.2 smoke test). The pattern:

1. Edit `scenes/main.tscn` directly to add instance references
2. Edit `src/core/main.gd` temporarily for initialization calls
3. Run project, verify output
4. Restore both files to clean state

### Scope Boundary

| Feature | Story |
|---|---|
| Grid data / cell occupancy | ST-4.1 (done) |
| Grid visual rendering | ST-4.2 (done) |
| **Chest node visual + destroy animation** | **ST-4.3 (this story)** |
| Chest spawning from server signal | ST-4.4 |
| Hero visual | ST-5.2 |

### Key Learnings from ST-4.1 and ST-4.2

- `class_name` collision: avoid built-in names. `Chest` is safe (not a Godot built-in)
- `@onready` vars require node to be in tree — only valid after `add_child()`, not in `initialize()` if called before `_ready()`
- Actually: `_ready()` fires when node enters tree (after `add_child()`). `@onready` resolves in `_ready()`. So `initialize()` called after `add_child()` can use `_sprite` and `_anim` safely
- `CONNECT_ONE_SHOT` flag avoids manual disconnect for one-time signals
- Godot 4.4+ auto-generates `.uid` sidecar files — document in File List
- Direct `.tscn` editing is more reliable than godot-mcp for scenes with autoload dependencies
- `PlaceholderTexture2D` is available in Godot 4 as a built-in resource — no external asset needed

### References

- Epic requirements: [Source: _bmad-output/epics/epic-4-grid-map-chest.md#ST-4.3]
- `ServerAPI.bomb_validated` signal: [Source: autoloads/server_api.gd:4]
- `GameGrid.mark_chest_cell` / `unmark_chest_cell`: [Source: src/map/grid_map.gd:76-89]
- `GridVisual.cell_to_pixel`: [Source: src/map/grid_visual.gd:30]
- `GridVisual.tile_size`: [Source: src/map/grid_visual.gd:9]
- Signal connect/disconnect rules: [Source: _bmad-output/project-context.md#Godot-4.x-Engine-Rules]
- Architecture — Chest location: [Source: _bmad-output/game-architecture.md#System-Location-Mapping] — `src/map/chest.gd`
- No magic numbers rule: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- ST-4.2 coordinate contract (cell_to_pixel + tile_size/2): [Source: _bmad-output/implementation-artifacts/4-2-grid-visual-render.md#Completion-Notes-List]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Warning 1: `@onready var _sprite` declared but never used → removed from script
- Warning 2: parameter `position` shadows built-in `Node2D.position` → renamed to `bomb_position`
- Both warnings resolved; second run clean with `[INFO] [Chest] Chest initialized — { "cell": (5, 5) }` ✅
- Code review fix M1: `animation_finished.connect()` moved to BEFORE `_anim.play("destroy")` to eliminate timing race
- Code review fix M2: `_exit_tree()` now guards disconnect with `is_connected()` to prevent runtime error if node freed before entering scene tree
- Code review fix L1: `chest.tscn` `ext_resource` updated to include `uid="uid://c06sst2dfenn6"` for script reference stability
- Code review fix L2: `_on_destroy_animation_finished` anim_name guard removed — handler only fires via `CONNECT_ONE_SHOT` after `destroy` plays, so guard was misleading; simplified to direct `queue_free()`

### Completion Notes List

- Animations created programmatically in `_setup_animations()` (called from `_ready()`) rather than via `.tscn` keyframe encoding — more reliable for this Godot headless dev workflow
- `_sprite` var not declared as `@onready` — Sprite2D exists in scene but script doesn't need a direct reference; `AnimationPlayer` tracks `Sprite2D:modulate:a` by node path string
- `_initialized: bool` flag guards `_on_bomb_validated` against the race window between `add_child()` (fires `_ready()`, connects signal) and `initialize()` completing
- `CONNECT_ONE_SHOT` used for `animation_finished` — auto-disconnects after first call, no manual cleanup needed
- `bomb_position` parameter name (not `position`) avoids shadowing `Node2D.position` built-in

### File List

- `src/map/chest.gd` (created)
- `src/map/chest.gd.uid` (auto-generated by Godot 4.4+)
- `scenes/treasure_hunt/chest.tscn` (created)
