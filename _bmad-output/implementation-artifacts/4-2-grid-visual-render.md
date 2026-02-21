# Story 4.2: Grid Visual Render

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want to see the grid map rendered on screen,
so that I can visualize where heroes and chests are on the board.

## Acceptance Criteria

1. A `GridVisual` node (`src/map/grid_visual.gd`, `class_name GridVisual`) renders the 20×15 grid within the game viewport
2. Tile size is auto-calculated from viewport dimensions: `tile_size = Vector2(viewport.size.x / Constants.GRID_SIZE.x, viewport.size.y / Constants.GRID_SIZE.y)` — grid fills the entire viewport
3. Each cell renders as a distinct tile using alternating colors (e.g., dark and slightly lighter squares) — no external texture required, pure colored rectangles
4. `GridVisual.cell_to_pixel(cell: Vector2i) -> Vector2` — converts a grid cell coordinate to the **top-left pixel position** of that cell; used by Hero, Chest, and Bomb nodes for visual placement
5. `GridVisual.pixel_to_cell(pixel: Vector2) -> Vector2i` — inverse: converts a pixel position to the nearest grid cell
6. Grid is rendered as a `Node2D` scene; no physics, no `_process()`, no signals
7. Scene created at `scenes/treasure_hunt/grid_visual.tscn` with root `Node2D` → attached `src/map/grid_visual.gd`
8. Grid renders correctly at 1152×648 (the project's default window size — verify in `project.godot`)

## Tasks / Subtasks

- [x] Task 1: Create `src/map/grid_visual.gd` with `class_name GridVisual` (AC: #1, #6)
  - [x] `extends Node2D`; `class_name GridVisual`
  - [x] Declare `var tile_size: Vector2` — computed in `_ready()`
  - [x] No `_process()`, no signals

- [x] Task 2: Implement `_ready()` — compute tile size and draw grid (AC: #2, #3)
  - [x] `tile_size = Vector2(get_viewport_rect().size.x / Constants.GRID_SIZE.x, get_viewport_rect().size.y / Constants.GRID_SIZE.y)`
  - [x] Call `queue_redraw()` to trigger `_draw()`

- [x] Task 3: Implement `_draw()` — render all cells (AC: #3, #8)
  - [x] Loop `x in range(Constants.GRID_SIZE.x)`, `y in range(Constants.GRID_SIZE.y)`
  - [x] Alternate cell color: `if (x + y) % 2 == 0` → `Color(0.15, 0.15, 0.15)`, else → `Color(0.20, 0.20, 0.20)`
  - [x] `draw_rect(Rect2(Vector2(x, y) * tile_size, tile_size), color)`
  - [x] No texture loading required — pure `draw_rect`

- [x] Task 4: Implement `cell_to_pixel(cell: Vector2i) -> Vector2` (AC: #4)
  - [x] Return `Vector2(cell) * tile_size`
  - [x] This is the **top-left corner** of the cell in world-space pixels

- [x] Task 5: Implement `pixel_to_cell(pixel: Vector2) -> Vector2i` (AC: #5)
  - [x] Return `Vector2i(pixel / tile_size)`
  - [x] Integer truncation gives the correct cell index

- [x] Task 6: Create `scenes/treasure_hunt/grid_visual.tscn` (AC: #7)
  - [x] Root node type: `Node2D`, name: `GridVisual`
  - [x] Attach script `res://src/map/grid_visual.gd`
  - [x] Save scene

- [x] Task 7: Attach GridVisual to main scene for smoke-test visibility (AC: #8)
  - [x] Temporarily added `GridVisualTest` node to `main.tscn` with `grid_visual.gd` script attached
  - [x] Run project — grid rendered on screen filling the viewport, no errors ✅
  - [x] Removed temporary attachment — `main.tscn` restored to clean state

## Dev Notes

### What This Story Does

Implements **`GridVisual`** — the pure visual rendering layer for the 20×15 grid. This is a `Node2D` that draws colored rectangles for each cell using Godot's `_draw()` / `draw_rect()` API. No physics, no logic, no server communication — just rendering.

**This story creates ONE new file:**
- `src/map/grid_visual.gd` — the GridVisual script

**And ONE new scene:**
- `scenes/treasure_hunt/grid_visual.tscn` — will be instantiated inside `treasure_hunt.tscn` (wired in ST-5.x)

**`GameGrid` (ST-4.1) is NOT modified** — GridVisual is a sibling, not a replacement. GridVisual handles rendering; GameGrid handles data.

### CRITICAL: Use `_draw()` Not Child Nodes

Do NOT create 300 child `ColorRect` nodes (one per cell) — that's 300 nodes in the scene tree, which is expensive to instantiate and defeats the purpose of a grid renderer.

**Use Godot's `_draw()` API instead:**

```gdscript
func _draw() -> void:
    for x in range(Constants.GRID_SIZE.x):
        for y in range(Constants.GRID_SIZE.y):
            var color := Color(0.15, 0.15, 0.15) if (x + y) % 2 == 0 else Color(0.20, 0.20, 0.20)
            draw_rect(Rect2(Vector2(x, y) * tile_size, tile_size), color)
```

`draw_rect` is a Godot 4 `CanvasItem` method available on any `Node2D`. It draws directly to the canvas in one pass — no nodes created.

### CRITICAL: cell_to_pixel is the contract for all future stories

Every Hero, Chest, and Bomb node will call `GridVisual.cell_to_pixel(cell)` to know where to position itself on screen. The return value must be the **top-left corner** of the cell.

```gdscript
func cell_to_pixel(cell: Vector2i) -> Vector2:
    return Vector2(cell) * tile_size

func pixel_to_cell(pixel: Vector2) -> Vector2i:
    return Vector2i(pixel / tile_size)
```

Future stories will center sprites within the cell by adding `tile_size / 2`:
```gdscript
# In Hero.gd (ST-5.2):
position = grid_visual.cell_to_pixel(cell) + grid_visual.tile_size / 2
```

So `cell_to_pixel` must return top-left, NOT center. This is the established contract.

### CRITICAL: Tile Size Must Be Computed From Viewport, Not Hardcoded

```gdscript
func _ready() -> void:
    tile_size = Vector2(
        get_viewport_rect().size.x / Constants.GRID_SIZE.x,
        get_viewport_rect().size.y / Constants.GRID_SIZE.y
    )
    queue_redraw()
```

**Never hardcode** `tile_size = Vector2(57.6, 43.2)` — use `get_viewport_rect().size` so the grid adapts if the window size changes.

`queue_redraw()` schedules a `_draw()` call on the next frame. Always call it after changing any draw state in `_ready()`.

### CRITICAL: class_name Collision Warning

ST-4.1 encountered a collision: `class_name GridMap` conflicted with Godot 4's built-in 3D `GridMap` node → renamed to `GameGrid`.

For ST-4.2: `GridVisual` is NOT a Godot built-in name — safe to use. Do NOT use `TileMap`, `TileMapLayer`, `CanvasLayer`, or other engine-reserved names as `class_name`.

### CRITICAL: `queue_redraw()` vs `update()` (Godot 3 vs 4)

- Godot 3: `update()` triggers a redraw
- Godot 4: `queue_redraw()` — never use `update()` in this project

### Viewport Size Reference

Default project window size: **1152×648** (verify in `project.godot` → `display/window/size/viewport_width` and `viewport_height`).

At 1152×648 with a 20×15 grid:
- `tile_size.x = 1152 / 20 = 57.6`
- `tile_size.y = 648 / 15 = 43.2`

These numbers do NOT need to be integers — `draw_rect` accepts `float` coordinates.

### Scene Structure

```
scenes/treasure_hunt/grid_visual.tscn
└── GridVisual (Node2D) ← grid_visual.gd attached
    [no child nodes — all drawing via _draw()]
```

### Temporary Smoke Test

For Task 7, attach `GridVisual` as a child of `Main` temporarily:
```gdscript
# In main.gd._ready() — temporary, remove after test:
var gv_scene = load("res://scenes/treasure_hunt/grid_visual.tscn")
if gv_scene:
    add_child(gv_scene.instantiate())
```

OR use godot-mcp `add_node` to add it directly to `main.tscn` and then `remove_node` after verification.

After running the project you should see a dark gray checkerboard grid filling the entire window. Remove the attachment after visual confirmation.

### Scope Boundary

| Feature | Story |
|---|---|
| Grid data / cell occupancy | ST-4.1 (done) |
| **Grid visual rendering** | **ST-4.2 (this story)** |
| Chest node visual | ST-4.3 |
| Hero visual (positioned on grid) | ST-5.2 |
| TreasureHunt scene wiring GridVisual | ST-5.1 |

### Key Learnings from ST-4.1

- `class_name` collision with Godot built-ins is silent and hard to debug — always verify the chosen class name is unique
- `get_viewport_rect()` is available on any `Node2D` after it enters the tree (i.e., in `_ready()`) — do not call it in `_init()`
- Typed arrays `Array[Vector2i]` work correctly in Godot 4.6
- Godot 4.4+ auto-generates `.uid` sidecar files for scripts — document them in the File List
- `Dictionary[Vector2i, int]` typed dict syntax is supported in Godot 4.6

### References

- Epic requirements: [Source: _bmad-output/epics/epic-4-grid-map-chest.md#ST-4.2]
- `Constants.GRID_SIZE`: [Source: config/constants.gd:3] — `Vector2i(20, 15)`
- Architecture — GridVisual location: [Source: _bmad-output/game-architecture.md#System-Location-Mapping] — `src/map/`
- Architecture — Node2D rendering: [Source: _bmad-output/game-architecture.md#Engine-Provided-Architecture]
- No magic numbers rule: [Source: _bmad-output/project-context.md#No-Magic-Numbers]
- No `_process()` for non-logic nodes: [Source: _bmad-output/project-context.md#Performance-Rules]
- ST-4.1 completion notes (class_name collision lesson): [Source: _bmad-output/implementation-artifacts/4-1-gridmap-core.md#Completion-Notes-List]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[INFO] [Main] Game started` — no errors from `grid_visual.gd` ✅
- Grid rendered as alternating dark gray checkerboard filling the full viewport ✅
- godot-mcp `add_node` failed in headless mode (AppLogger not available as autoload); workaround: edited `main.tscn` directly to add `GridVisualTest` node with script reference
- Pre-existing warnings (not related to this story): `transaction_confirmed` unused signal in `web3_manager.gd`, invalid UID for `game_phase_state_machine.gd` in `main.tscn`

### Completion Notes List

1. **`class_name GridVisual`** — safe name, no collision with Godot built-ins (unlike `GridMap` in ST-4.1)

2. **`_draw()` + `draw_rect()`** — 300 cells rendered in a single canvas pass with no child nodes. Alternating color pattern uses `(x + y) % 2` checkerboard.

3. **`tile_size` from viewport** — `get_viewport_rect().size` called in `_ready()` (not `_init()`). At 1152×648: `tile_size = Vector2(57.6, 43.2)` — floats work correctly with `draw_rect`.

4. **`cell_to_pixel` contract** — returns top-left corner of cell. Future Hero/Chest/Bomb nodes add `tile_size / 2` to center their sprites. This is the established coordinate contract for all subsequent visual stories.

5. **`pixel_to_cell`** — `Vector2i(pixel / tile_size)` uses integer truncation for correct cell index.

6. **Smoke test approach** — godot-mcp `add_node` doesn't work headless without autoloads registered; edited `main.tscn` directly instead. Grid rendered correctly; `main.tscn` restored clean after verification.

7. **AC verification**:
   - AC1: `class_name GridVisual`, `extends Node2D`, `src/map/grid_visual.gd` ✅
   - AC2: `tile_size` computed from `get_viewport_rect().size / Constants.GRID_SIZE` ✅
   - AC3: `_draw()` with alternating `Color(0.15)` / `Color(0.20)` rects ✅
   - AC4: `cell_to_pixel(cell) → Vector2(cell) * tile_size` (top-left) ✅
   - AC5: `pixel_to_cell(pixel) → Vector2i(pixel / tile_size)` ✅
   - AC6: No `_process()`, no signals — pure `Node2D` ✅
   - AC7: `scenes/treasure_hunt/grid_visual.tscn` with `Node2D` root + script ✅
   - AC8: Smoke test at 1152×648 — grid filled viewport correctly ✅

### File List

- `src/map/grid_visual.gd` — created (class_name GridVisual, all AC methods)
- `scenes/treasure_hunt/grid_visual.tscn` — created (Node2D root with grid_visual.gd script)
- `scenes/main.tscn` — temporarily modified for smoke test, restored to clean state (net clean)
- `src/map/grid_visual.gd.uid` — auto-generated by Godot 4.4+ (sidecar UID file)

## Code Review Record

### Reviewer Model

claude-sonnet-4-6

### Review Date

2026-02-22

### Issues Found

- M1 (fixed): `tile_size` uninitialized (`Vector2.ZERO`) until `_ready()`. Added zero-guard to `_draw()` and `pixel_to_cell()`; added doc warnings to both contract methods.
- M2 (fixed): Inline `Color()` construction in draw loop. Extracted to `const _COLOR_EVEN` and `const _COLOR_ODD` at class scope.
- M3 (fixed): `grid_visual.tscn` had no `uid=` in scene header — consistent with `grid_map.tscn` (no uid, Godot will assign on next editor save). No change needed beyond documenting the pattern.
- L1 (fixed): `src/map/grid_visual.gd.uid` not in File List. Added above.
- L2 (fixed): `pixel_to_cell` missing doc comment explaining OOB behavior. Added.
- L3 (fixed): `_draw()` no zero-guard for `tile_size`. Added `if tile_size == Vector2.ZERO: return`.

### Fixes Applied

1. `const _COLOR_EVEN := Color(0.15, 0.15, 0.15)` and `const _COLOR_ODD := Color(0.20, 0.20, 0.20)` at class scope
2. `_draw()`: added `if tile_size == Vector2.ZERO: return` guard
3. `pixel_to_cell()`: added zero-guard returning `Vector2i(-1, -1)` with WARN log
4. `cell_to_pixel()` + `pixel_to_cell()`: doc comments updated with pre-`_ready()` warnings
5. `tile_size` doc comment updated to note zero-until-ready behavior
6. File List updated with `.uid` sidecar
