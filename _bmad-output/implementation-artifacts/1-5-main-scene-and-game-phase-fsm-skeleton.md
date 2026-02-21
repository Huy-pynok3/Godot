# Story 1.5: Main Scene & Game Phase FSM Skeleton

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a main scene that boots to a Lobby placeholder and a GamePhaseStateMachine with 3 states,
so that the project runs end-to-end without crashing and future epics can drive phase transitions.

## Acceptance Criteria

1. `scenes/main.tscn` exists and is set as the main scene in `project.godot` (`application/run/main_scene`)
2. `src/core/main.gd` is attached to the root node of `main.tscn`, extending `Node`
3. `src/core/game_phase_state_machine.gd` exists with `class_name GamePhaseStateMachine`, `extends Node`, and enum `Phase { LOBBY, TREASURE_HUNT, REST }`
4. `GamePhaseStateMachine` has `var current_phase: Phase = Phase.LOBBY` (starts in LOBBY)
5. `GamePhaseStateMachine` has `func transition_to(new_phase: Phase) -> void` that logs the transition and updates `current_phase`
6. `GamePhaseStateMachine` node is a child of the main scene root, named `GamePhaseStateMachine` (PascalCase)
7. `main.gd` loads `debug_panel.tscn` as a child **only** when `OS.is_debug_build() == true`
8. Project boots without errors or crashes in editor (black/placeholder screen is acceptable)
9. `src/core/main.gd` and `src/core/game_phase_state_machine.gd` use `AppLogger` for logging — no bare `print()` calls

## Tasks / Subtasks

- [x] Task 1: Create `src/core/game_phase_state_machine.gd` (AC: #3, #4, #5)
  - [x] `class_name GamePhaseStateMachine`
  - [x] `extends Node`
  - [x] `enum Phase { LOBBY, TREASURE_HUNT, REST }`
  - [x] `var current_phase: Phase = Phase.LOBBY`
  - [x] `func transition_to(new_phase: Phase) -> void` — logs transition + updates `current_phase`
  - [x] Use `AppLogger.info("GamePhaseStateMachine", ...)` for the transition log
- [x] Task 2: Create `src/core/main.gd` (AC: #2, #7, #9)
  - [x] `extends Node`
  - [x] `func _ready() -> void`
  - [x] Load `debug/debug_panel.tscn` and `add_child()` only inside `if OS.is_debug_build()`
  - [x] Log game start with `AppLogger.info("Main", "Game started")`
  - [x] No bare `print()` calls
- [x] Task 3: Create `scenes/main.tscn` (AC: #1, #6)
  - [x] Root node type: `Node`, named `Main`
  - [x] Attach `res://src/core/main.gd` script to root node
  - [x] Add `GamePhaseStateMachine` child node (type `Node`), attach `res://src/core/game_phase_state_machine.gd`
  - [x] Remove `scenes/.gitkeep` (directory now has a real file)
- [x] Task 4: Set main scene in `project.godot` (AC: #1)
  - [x] Add `run/main_scene="res://scenes/main.tscn"` under `[application]` section
  - [x] Verify `[autoload]` section still intact with all 5 entries
  - [x] Verify `[rendering]` section still intact

## Dev Notes

### What This Story Does

Creates the entry point of the game: `scenes/main.tscn` (with `main.gd`) and the `GamePhaseStateMachine` state machine skeleton. After this story, the project runs (boots to a black screen / Lobby placeholder), the phase FSM is in place as a node the rest of the game can call `transition_to()` on, and the DebugPanel is conditionally loaded.

This is a **skeleton only** — no scene-switching logic, no actual Lobby UI, no FSM signals. All of that comes in Epic 7 and Epic 8. The task is to get the project bootable with the correct node structure.

### Critical: .tscn File Format in Godot 4

Godot `.tscn` files are **not created by hand** — they have a precise binary-like text format with GUIDs and UIDs that Godot generates. However, for this story, we must create them as text since there is no Godot editor available during AI implementation.

**Godot 4 `.tscn` text format for a minimal scene:**

```
[gd_scene load_steps=2 format=3 uid="uid://XXXXXXXXXXXXXXX"]

[ext_resource type="Script" path="res://src/core/main.gd" id="1_XXXXX"]

[node name="Main" type="Node"]
script = ExtResource("1_XXXXX")

[node name="GamePhaseStateMachine" type="Node" parent="."]
script = ExtResource("2_XXXXX")
```

**The simplest valid approach:** Create a minimal `.tscn` with placeholder UIDs. Godot will regenerate proper UIDs on first open. Use the exact format below:

```
[gd_scene load_steps=3 format=3 uid="uid://cqibf3e3p0a3b"]

[ext_resource type="Script" path="res://src/core/main.gd" id="1_main"]
[ext_resource type="Script" path="res://src/core/game_phase_state_machine.gd" id="2_gpsm"]

[node name="Main" type="Node"]
script = ExtResource("1_main")

[node name="GamePhaseStateMachine" type="Node" parent="."]
script = ExtResource("2_gpsm")
```

**Key rules:**
- `load_steps` = number of `[ext_resource]` blocks + 1
- `uid` can be any valid-looking string — Godot regenerates on open
- `id` in `[ext_resource]` must match the `ExtResource("id")` reference exactly
- Node name must match AC #6: `GamePhaseStateMachine` (PascalCase)

### Exact Stub Implementations

```gdscript
# src/core/game_phase_state_machine.gd
class_name GamePhaseStateMachine
extends Node

enum Phase { LOBBY, TREASURE_HUNT, REST }

var current_phase: Phase = Phase.LOBBY

func transition_to(new_phase: Phase) -> void:
	AppLogger.info("GamePhaseStateMachine", "Phase transition", {
		from = Phase.keys()[current_phase],
		to = Phase.keys()[new_phase]
	})
	current_phase = new_phase
```

```gdscript
# src/core/main.gd
extends Node

func _ready() -> void:
	AppLogger.info("Main", "Game started")
	if OS.is_debug_build():
		var panel = preload("res://debug/debug_panel.tscn").instantiate()
		add_child(panel)
```

**Notes on `main.gd`:**
- `preload()` for `debug_panel.tscn` is inside the `if OS.is_debug_build()` guard — this is intentional. `preload()` is compile-time in GDScript but inside a conditional branch it only executes (and loads the resource) when the condition is true in practice. This is the architecture's recommended pattern (`game-architecture.md#Debug-Tools`).
- No `class_name` needed for `main.gd` — it is never instantiated by name, it's always loaded via scene.

### project.godot Changes

Add `run/main_scene` under `[application]`. The section becomes:

```ini
[application]

config/name="BombCrypto Remake"
config/features=PackedStringArray("4.6", "gl_compatibility")
config/icon="res://icon.svg"
run/main_scene="res://scenes/main.tscn"
```

Do **not** touch `[rendering]` or `[autoload]` sections — only add the `run/main_scene` line to `[application]`.

### DebugPanel Dependency

`main.gd` uses `preload("res://debug/debug_panel.tscn")`. The `debug/` directory currently has only `.gitkeep`. The DebugPanel **is NOT created in this story** — it's ST-1.6.

**Problem:** `preload()` at parse time will fail if `debug_panel.tscn` doesn't exist.

**Solution:** Use `load()` instead of `preload()` inside the `if OS.is_debug_build()` guard, OR create a minimal placeholder `debug/debug_panel.tscn`. The story spec says `main.gd` should *load* the panel — the most correct approach for this stub is to use `load()` (runtime, not parse-time) so the file doesn't need to exist until the debug build is actually run.

**Revised `main.gd` using `load()` for the debug panel:**

```gdscript
# src/core/main.gd
extends Node

func _ready() -> void:
	AppLogger.info("Main", "Game started")
	if OS.is_debug_build():
		var panel_scene = load("res://debug/debug_panel.tscn")
		if panel_scene:
			add_child(panel_scene.instantiate())
		else:
			AppLogger.warn("Main", "DebugPanel scene not found — will be added in ST-1.6")
```

This way, `main.gd` is correct for this story, and ST-1.6 will provide the actual scene file. No parse error, no crash even in debug builds before ST-1.6 is done.

### Accessing GamePhaseStateMachine from Other Nodes

`GamePhaseStateMachine` is a **child node in the main scene**, NOT an autoload. Future epics access it via the scene tree:

```gdscript
# From any node in the main scene tree:
var fsm := get_tree().root.get_node("Main/GamePhaseStateMachine") as GamePhaseStateMachine
fsm.transition_to(GamePhaseStateMachine.Phase.TREASURE_HUNT)

# Or via a typed reference passed by main.gd to child scenes (preferred in Epic 8):
# main.gd exposes @onready var fsm := $GamePhaseStateMachine
```

**Not** accessed as an autoload — `GamePhaseStateMachine` is instantiated by the scene, not by `project.godot`.

### What is NOT in This Story

| Feature | Lives in | Implemented in |
|---|---|---|
| Actual Lobby UI scene | ST-7.1 | `scenes/lobby/lobby.tscn` |
| FSM signals (`phase_changed`) | ST-8.1 | `game_phase_state_machine.gd` |
| FSM driving scene transitions | ST-8.1 | `main.gd` + `game_phase_state_machine.gd` |
| DebugPanel F1/F2 toggle | ST-1.6 | `debug/debug_panel.tscn` |
| Hero spawn in TreasureHunt | ST-8.2 | `src/core/` or `scenes/treasure_hunt/` |

Do NOT implement any of the above in this story — skeleton only.

### .gitkeep Cleanup

- Remove `scenes/.gitkeep` when creating `scenes/main.tscn`
- Do **NOT** remove `scenes/lobby/.gitkeep`, `scenes/treasure_hunt/.gitkeep`, `scenes/rest/.gitkeep` — those directories are still empty (their scenes come in later epics)
- Do NOT remove `src/core/.gitkeep` — it will be replaced implicitly when `.gd` files are added (though explicitly removing it is fine)

### Previous Story Learnings

- ST-1.4: `src/hero/.gitkeep` — `AD` git state when staged-add not cleaned up before deletion. For `scenes/.gitkeep`: same risk. Note the state in completion notes.
- ST-1.4: `.uid` files — Godot auto-generates `*.gd.uid` for every GDScript. The `.tscn` also gets a `.uid` file (`scenes/main.tscn.uid`). Document all auto-generated files in File List.
- ST-1.2/1.3/1.4: Runtime verification (AC #8 — project boots without errors) not possible during AI implementation. Document in completion notes that the developer must verify in Godot editor.
- ST-1.1/1.2 reviews: `project.godot` edits must preserve all existing sections. After adding `run/main_scene`, verify `[autoload]` and `[rendering]` sections remain intact.
- Architecture pattern: `preload()` inside `if OS.is_debug_build()` is the architecture's stated pattern, but `load()` is safer for a stub when the target file doesn't exist yet (ST-1.6 creates `debug_panel.tscn`).

### Project Structure After This Story

```
scenes/
  main.tscn          ← ST-1.5 (this story)
  lobby/
    .gitkeep         ← stays until ST-7.1
  treasure_hunt/
    .gitkeep         ← stays until ST-7.x
  rest/
    .gitkeep         ← stays until ST-7.4

src/core/
  main.gd            ← ST-1.5 (this story)
  game_phase_state_machine.gd  ← ST-1.5 (this story)
  .gitkeep           ← can be removed
```

### References

- Main scene requirement: [Source: game-architecture.md#Project-Structure → scenes/main.tscn]
- GamePhaseStateMachine location: [Source: game-architecture.md#System-Location-Mapping]
- GamePhaseStateMachine phases: [Source: game-architecture.md#State-Management → GamePhaseStateMachine]
- DebugPanel conditional load pattern: [Source: game-architecture.md#Debug-Tools]
- AppLogger usage pattern: [Source: game-architecture.md#Logging]
- main_scene project.godot setting: [Source: epics/epic-1-project-setup.md#ST-1.5]
- No bare print() rule: [Source: project-context.md#AppLogger-Usage]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — skeleton files; no runtime logic to debug.

### Completion Notes List

- Created `src/core/game_phase_state_machine.gd` with `class_name GamePhaseStateMachine`, `extends Node`, `enum Phase { LOBBY, TREASURE_HUNT, REST }`, `var current_phase: Phase = Phase.LOBBY`, and `func transition_to(new_phase: Phase) -> void`. Uses `Phase.keys()[phase]` for human-readable enum name logging via `AppLogger.info`.
- Created `src/core/main.gd` with `extends Node` and `_ready()` that logs "Game started" via `AppLogger.info`, then conditionally loads `debug/debug_panel.tscn` using `load()` (not `preload()`) with a null guard. Using `load()` prevents a parse error since `debug_panel.tscn` does not exist until ST-1.6.
- Created `scenes/main.tscn` in Godot 4 text format (`format=3`). The linter adjusted the header from `load_steps=3` to no `load_steps` (also valid). Root node `Main` (Node type) with `main.gd` script; child node `GamePhaseStateMachine` (Node type) with `game_phase_state_machine.gd` script.
- Removed `scenes/.gitkeep` and `src/core/.gitkeep` (replaced by real files).
- Added `run/main_scene="res://scenes/main.tscn"` to `[application]` section in `project.godot`. Verified `[rendering]` and `[autoload]` sections intact (5 autoloads preserved).
- ⚠️ AC#8 (project boots without errors): runtime verification not possible during AI implementation — developer must open project in Godot editor to confirm. The `.tscn` format was linter-adjusted; Godot should regenerate proper UIDs on first open.
- ⚠️ `scenes/.gitkeep` may have `AD` git state (same pattern as previous stories). Note for developer.
- No bare `print()` calls in any file — all logging via `AppLogger`.

### Change Log

- 2026-02-21: Created game_phase_state_machine.gd, main.gd; created scenes/main.tscn; updated project.godot with run/main_scene; removed scenes/.gitkeep, src/core/.gitkeep

### File List

- `src/core/game_phase_state_machine.gd` (new)
- `src/core/game_phase_state_machine.gd.uid` (new — Godot auto-generated)
- `src/core/main.gd` (new)
- `src/core/main.gd.uid` (new — Godot auto-generated)
- `src/core/.gitkeep` (deleted)
- `scenes/main.tscn` (new)
- `scenes/main.tscn.uid` (new — Godot auto-generated)
- `scenes/.gitkeep` (deleted)
- `project.godot` (modified — added run/main_scene to [application])
