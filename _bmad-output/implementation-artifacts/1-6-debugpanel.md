# Story 1.6: DebugPanel

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a DebugPanel that loads only in debug builds with F1 toggle and F2 GameState dump,
so that I have in-game diagnostics without any debug UI leaking into release/WebGL exports.

## Acceptance Criteria

1. `debug/debug_panel.tscn` exists with a root `Control` node and at least one `Label` child as a placeholder
2. `debug/debug_panel.gd` is attached to the root node of `debug_panel.tscn`, extending `Control`
3. `F1` key toggles panel visibility (`show()`/`hide()` or `visible = !visible`)
4. `F2` key prints a full `GameState` dump to console via `AppLogger`
5. The panel is **only** added as a child of Main when `OS.is_debug_build() == true` — this is already wired in `main.gd` (ST-1.5), so `debug_panel.tscn` just needs to exist and function correctly
6. `debug/debug_panel.gd` uses `AppLogger` for all output — no bare `print()` calls
7. `debug/debug_panel.tscn` does NOT appear in any non-debug scene and is never `preload()`-ed outside of the `OS.is_debug_build()` guard
8. `debug/.gitkeep` is removed (replaced by real files)

## Tasks / Subtasks

- [x] Task 1: Create `debug/debug_panel.gd` (AC: #2, #3, #4, #6)
  - [x] `extends Control`
  - [x] `func _ready() -> void` — set initial visibility, log panel ready
  - [x] `func _input(event: InputEvent) -> void` — handle F1 and F2 key presses
  - [x] F1: toggle `visible` (show/hide the panel)
  - [x] F2: call `_dump_game_state()` private helper
  - [x] `func _dump_game_state() -> void` — read `GameState` vars and log via `AppLogger.info`
  - [x] No bare `print()` calls anywhere
- [x] Task 2: Create `debug/debug_panel.tscn` (AC: #1, #2)
  - [x] Root node type: `Control`, named `DebugPanel`
  - [x] Attach `res://debug/debug_panel.gd` script to root node
  - [x] Add at least one `Label` child node named `TitleLabel` with text `"[DEBUG]"` as placeholder
  - [x] Remove `debug/.gitkeep`

## Dev Notes

### What This Story Does

Creates the `DebugPanel` — a developer-only overlay that gives in-game diagnostics during debug builds. The panel:
- Is instantiated by `main.gd` (already written in ST-1.5) via `load("res://debug/debug_panel.tscn")` inside `if OS.is_debug_build()`
- F1 toggles visibility
- F2 dumps `GameState` (wallet_address, active_hero_ids, bcoin_balance) to the AppLogger output

After this story, the persistent warning in `main.gd` ("DebugPanel scene not found — will be added in ST-1.6") disappears when the project runs in debug mode.

### Critical: ST-1.5 Integration — `main.gd` Already Handles Loading

`main.gd` (from ST-1.5) already contains:

```gdscript
if OS.is_debug_build():
    var panel_scene = load("res://debug/debug_panel.tscn")
    if panel_scene:
        add_child(panel_scene.instantiate())
    else:
        AppLogger.warn("Main", "DebugPanel scene not found — will be added in ST-1.6")
```

This story's job is to create `debug_panel.tscn` so that `load()` succeeds. **Do NOT modify `main.gd`** — it is already correct. The only files to create are `debug/debug_panel.gd` and `debug/debug_panel.tscn`.

### Note on `main.gd` M1 Finding (from ST-1.5 code review)

The code review for ST-1.5 found that `var panel_scene = load(...)` is untyped (should be `var panel_scene: PackedScene`). That fix is out of scope for ST-1.6 — it belongs to `main.gd` which was ST-1.5's file. Do NOT modify `main.gd` in this story. The M1 finding in the ST-1.5 review is carried forward as a known issue.

### Exact Stub Implementation

```gdscript
# debug/debug_panel.gd
extends Control

func _ready() -> void:
	AppLogger.info("DebugPanel", "Debug panel ready — F1 toggle, F2 dump GameState")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F1:
			visible = !visible
		elif event.keycode == KEY_F2:
			_dump_game_state()

func _dump_game_state() -> void:
	AppLogger.info("DebugPanel", "GameState dump", {
		wallet_address = GameState.wallet_address,
		active_hero_ids = GameState.active_hero_ids,
		bcoin_balance = GameState.bcoin_balance
	})
```

**Key implementation notes:**
- `event.pressed and not event.echo` — prevents key repeat from firing dump/toggle multiple times when key held
- `InputEventKey` check before accessing `event.keycode` — safe casting pattern in GDScript 4
- `KEY_F1` / `KEY_F2` are Godot 4 built-in `Key` enum constants (not `KEY_F1` string) — correct usage
- `GameState.wallet_address`, `.active_hero_ids`, `.bcoin_balance` — direct autoload access (correct per architecture)
- No `_process()` or `_physics_process()` — key input is event-driven, not polled

### .tscn Format for debug_panel.tscn

Use the same Godot 4 text format established in ST-1.5:

```
[gd_scene format=3 uid="uid://debugpanel001"]

[ext_resource type="Script" path="res://debug/debug_panel.gd" id="1_dp"]

[node name="DebugPanel" type="Control"]
script = ExtResource("1_dp")

[node name="TitleLabel" type="Label" parent="."]
text = "[DEBUG]"
```

**Notes:**
- Root node must be `Control` (not `Node`) — DebugPanel is a UI overlay; `Control` handles layout and input correctly in Godot 4
- `Control` inherits from `CanvasItem` which means `visible` property and `show()`/`hide()` work as expected
- The `Label` child is a placeholder — it will be enhanced in Epic 7 (ST-7.x) with real stats displays
- `uid` is a placeholder; Godot regenerates on first editor open

### Why `Control` not `Node`

The architecture specifies `debug/debug_panel.tscn` as a UI overlay. `Control` is the correct base type because:
1. `visible` property controls rendering (needed for F1 toggle)
2. `_input()` is processed in UI layer — no need to set `process_mode`
3. Future enhancement (Epic 7) will add `Label`, `VBoxContainer` etc. — all extend `Control`

Using `Node` would require extra setup to handle visibility and UI hierarchy. `Control` is the right choice for any UI panel.

### Input Handling — Why `_input()` not `_unhandled_input()`

Using `_input(event)` directly:
- `_unhandled_input()` skips events that were handled by a `Control` node's GUI focus system
- Since the DebugPanel is always an overlay, using `_input()` ensures F1/F2 always work regardless of what UI has focus
- Per project-context: "Minimal player input (idle game) — use InputMap actions for clickable UI; never hardcode `MOUSE_BUTTON_LEFT`" — F-keys are debug-only and do not need InputMap actions (they're not player-facing)

### Architecture Boundary: debug/ Rule

Per `game-architecture.md#Architectural-Boundaries` rule 5:
> `debug/` — never imported by production code paths; always gated by `OS.is_debug_build()`

The `debug_panel.gd` script:
- Is only ever loaded via `load()` inside `if OS.is_debug_build()` in `main.gd` ✅
- Must NEVER be `preload()`-ed at the top level of any file ✅
- Must NEVER be referenced by any non-debug code path ✅

### GameState Dump — Current Fields

`GameState` (from ST-1.4) currently has:
```gdscript
var wallet_address: String = ""
var active_hero_ids: Array[int] = []
var bcoin_balance: float = 0.0
```

The F2 dump should log all 3 fields. Future stories will add more vars to `GameState`; the DebugPanel dump will be updated then. For now, log exactly these 3.

### AppLogger Usage Pattern

From `project-context.md#AppLogger-Usage`:
- First argument is always the system name: `AppLogger.info("DebugPanel", ...)`
- Never `print()` directly — always use `AppLogger`
- DebugPanel's output only appears in debug builds anyway (AppLogger.info gates on `OS.is_debug_build()`), but still follow the convention

### Project Structure After This Story

```
debug/
  debug_panel.tscn    ← ST-1.6 (this story)
  debug_panel.gd      ← ST-1.6 (this story)
  .gitkeep            ← deleted
```

After this story, Epic 1 is complete (all 6 stories done). The project should boot, show a black screen, load the DebugPanel in debug builds, and respond to F1/F2.

### Previous Story Learnings

- ST-1.5: `.tscn` files created as text with placeholder UIDs — Godot regenerates on first editor open. Same pattern here.
- ST-1.5: Linter removed `load_steps=N` from `[gd_scene]` header — omit it from the start.
- ST-1.5: `load()` vs `preload()` — `debug_panel.gd` itself can use normal `preload()` for any resources it needs (there are none in this stub); `main.gd` already uses `load()` to load the panel.
- ST-1.2/1.3/1.4/1.5: Runtime verification not possible during AI implementation. AC#5 (panel loads in debug build) requires developer to run the project in Godot editor to confirm.
- ST-1.4/1.5: Auto-generated `.uid` files — document `debug_panel.gd.uid` and `debug_panel.tscn.uid` in File List.
- ST-1.4/1.5: `.gitkeep` files with `AD` git state when staged-add not cleaned up before deletion — note in completion notes.

### References

- DebugPanel spec: [Source: epics/epic-1-project-setup.md#ST-1.6]
- Debug tools architecture: [Source: game-architecture.md#Debug-Tools] — F1/F2 toggle and state dump
- Debug gating rule: [Source: game-architecture.md#Architectural-Boundaries rule 5]
- AppLogger usage: [Source: project-context.md#AppLogger-Usage]
- GameState vars: [Source: autoloads/game_state.gd] — wallet_address, active_hero_ids, bcoin_balance
- Control node for UI overlays: [Source: game-architecture.md#Engine-Provided-Architecture]
- ST-1.5 integration: [Source: implementation-artifacts/1-5-main-scene-and-game-phase-fsm-skeleton.md#main.gd] — load() already wired

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — UI stub; no runtime logic to debug beyond static inspection.

### Completion Notes List

- Created `debug/debug_panel.gd` with `extends Control`. `_ready()` logs panel ready via `AppLogger.info`. `_input()` checks `InputEventKey` with `event.pressed and not event.echo` guard to prevent key-repeat firing. F1 toggles `visible = !visible`; F2 calls `_dump_game_state()` which logs all 3 `GameState` vars (wallet_address, active_hero_ids, bcoin_balance) via `AppLogger.info`. No bare `print()` calls.
- Created `debug/debug_panel.tscn` with root node `DebugPanel` (type `Control`), `debug_panel.gd` attached, and `TitleLabel` (type `Label`) child with `text = "[DEBUG]"`. Format=3, placeholder UID — Godot regenerates on first editor open.
- Removed `debug/.gitkeep`.
- ⚠️ AC#3/4/5 runtime verification (F1 toggle, F2 dump, panel loads in debug build) not possible during AI implementation — developer must open project in Godot editor to confirm.
- ⚠️ `debug/.gitkeep` may have `AD` git state (same pattern as previous stories). Note for developer.
- ST-1.5 M1 finding (`panel_scene` untyped in `main.gd`) is out of scope for this story — NOT fixed here per story boundary.
- All `GameState` fields logged in F2 dump match the current stub (wallet_address, active_hero_ids, bcoin_balance from ST-1.4).

### Change Log

- 2026-02-21: Created debug_panel.gd, debug_panel.tscn; removed debug/.gitkeep

### File List

- `debug/debug_panel.gd` (new)
- `debug/debug_panel.gd.uid` (new — Godot auto-generated)
- `debug/debug_panel.tscn` (new)
- `debug/debug_panel.tscn.uid` (new — Godot auto-generated on first editor open)
- `debug/.gitkeep` (deleted)
