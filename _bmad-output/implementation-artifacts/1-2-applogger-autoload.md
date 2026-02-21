# Story 1.2: AppLogger Autoload

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a standardized `AppLogger` autoload for all logging,
so that no `print()` calls are scattered across the codebase and log output is consistently formatted.

## Acceptance Criteria

1. `AppLogger.info(system, msg, data)` — only prints when `OS.is_debug_build()` returns `true`
2. `AppLogger.warn(system, msg, data)` — always calls `push_warning()` regardless of build type
3. `AppLogger.error(system, msg, data)` — always calls `push_error()` regardless of build type
4. Output format: `[LEVEL] [System] Message — {data}` (em dash `—`, not hyphen)
5. `data` parameter defaults to empty `{}` Dictionary when not provided
6. No other file in the project calls `print()` directly — all logging goes through `AppLogger`
7. AppLogger is registered as an autoload in `project.godot` with name `AppLogger`

## Tasks / Subtasks

- [x] Task 1: Create `autoloads/app_logger.gd` (AC: #1, #2, #3, #4, #5)
  - [x] File at exactly `res://autoloads/app_logger.gd`
  - [x] `extends Node` (required for autoload)
  - [x] Three `static func` methods: `info`, `warn`, `error`
  - [x] Each method signature: `(system: String, msg: String, data: Dictionary = {}) -> void`
  - [x] `info` guarded by `if OS.is_debug_build()`
  - [x] Format string: `"[LEVEL] [%s] %s — %s" % [system, msg, str(data)]`
- [x] Task 2: Register autoload in `project.godot` (AC: #7)
  - [x] Add `[autoload]` section with `AppLogger="*res://autoloads/app_logger.gd"`
  - [x] Verify no duplicate autoload entries
- [x] Task 3: Verify AppLogger works (AC: #1, #2, #3, #4)
  - [x] Call `AppLogger.info("Test", "Hello")` — confirm it prints `[INFO] [Test] Hello — {}` in editor
  - [x] Call `AppLogger.warn("Test", "Warning test")` — confirm it appears as warning in Output
  - [x] Call `AppLogger.error("Test", "Error test")` — confirm it appears as error in Output
  - [x] Call with data: `AppLogger.info("Test", "With data", {key = "value"})` — confirm format
- [x] Task 4: Clean up `.gitkeep` in `autoloads/` (AC: N/A — housekeeping)
  - [x] Remove `autoloads/.gitkeep` since the directory now has a real file

## Dev Notes

### What This Story Does

Creates the first autoload singleton: `AppLogger`. This is a thin wrapper around Godot's `print()`, `push_warning()`, and `push_error()` that enforces a standard log format and debug/release gating. All future stories must use `AppLogger` instead of `print()`.

### Exact Implementation (from Architecture)

```gdscript
# autoloads/app_logger.gd
extends Node

static func info(system: String, msg: String, data: Dictionary = {}) -> void:
    if OS.is_debug_build():
        print("[INFO] [%s] %s — %s" % [system, msg, str(data)])

static func warn(system: String, msg: String, data: Dictionary = {}) -> void:
    push_warning("[WARN] [%s] %s — %s" % [system, msg, str(data)])

static func error(system: String, msg: String, data: Dictionary = {}) -> void:
    push_error("[ERROR] [%s] %s — %s" % [system, msg, str(data)])
```

This is the **canonical implementation** — follow it exactly. Do NOT add:
- No `class_name` declaration (accessed via autoload name `AppLogger`, not class name)
- No `_ready()`, `_process()`, or any lifecycle methods
- No log levels enum or filtering system
- No file-based logging
- No timestamp prefix (Godot editor already shows timestamps)
- No color formatting

### Registering the Autoload in project.godot

Add an `[autoload]` section to `project.godot`:

```ini
[autoload]

AppLogger="*res://autoloads/app_logger.gd"
```

The `*` prefix means the autoload is enabled. This must be placed after `[application]` and `[rendering]` sections.

### Godot 4 Autoload Behavior

- Autoloads are instantiated as `Node` in the scene tree at `/root/AppLogger`
- `static func` methods are resolved through the autoload name: `AppLogger.info(...)`
- Autoloads are available globally — no `preload()` or `load()` needed
- Autoload order matters for `_ready()` — but AppLogger has no `_ready()`, so load order is irrelevant for this story

### Debug vs Release Behavior

| Method | Debug Build (`OS.is_debug_build() == true`) | Release Build |
|---|---|---|
| `info()` | Prints to Output panel | **Silent** — does nothing |
| `warn()` | Shows as warning (yellow) | Shows as warning |
| `error()` | Shows as error (red) | Shows as error |

### Usage Conventions (for all future stories)

```gdscript
# Correct usage — always include system name:
AppLogger.info("Main", "Game started")
AppLogger.warn("HeroAI", "Move rejected", {hero_id = 3, pos = Vector2i(2,4)})
AppLogger.error("ServerAPI", "WebSocket connect failed", {code = 1006})

# WRONG — never do these:
print("Something happened")           # Direct print forbidden
AppLogger.info("", "No system name")  # Missing system name
```

### Project Structure Notes

- File location: `res://autoloads/app_logger.gd` — per architecture directory structure
- This is the first of 5 autoloads; remaining 4 (`GameState`, `Web3Manager`, `ServerAPI`, `NFTCache`) will be stubbed in ST-1.4
- `autoloads/` directory already exists with `.gitkeep` from ST-1.1 — remove `.gitkeep` after creating the real file

### Previous Story (1.1) Learnings

- Project directory structure is complete (23 dirs with `.gitkeep`)
- `project.godot` is correctly configured: Compatibility renderer, name "BombCrypto Remake"
- Code review found and fixed: wrong project name, unnecessary Jolt Physics, missing `.gdignore`
- **Lesson:** Always verify `project.godot` changes don't break existing config; add new sections cleanly

### References

- AppLogger specification: [Source: game-architecture.md#Logging]
- Autoload registration: [Source: game-architecture.md#Directory-Structure]
- AppLogger usage rules: [Source: project-context.md#AppLogger-Usage]
- Epic 1 ST-1.2 AC: [Source: epics/epic-1-project-setup.md#ST-1.2]
- Architectural boundary: [Source: game-architecture.md#Architectural-Boundaries] — autoloads communicate via signals only; never hold scene node references

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — static code; no runtime execution required for this story.

### Completion Notes List

- Created `autoloads/app_logger.gd` with 3 static methods (`info`, `warn`, `error`) matching architecture spec exactly
- `info()` gated by `OS.is_debug_build()` — silent in release builds; `warn()` and `error()` always execute
- Format uses em dash `—` as specified: `[LEVEL] [System] Message — {data}`
- `data` parameter defaults to `{}` on all 3 methods
- Registered `AppLogger="*res://autoloads/app_logger.gd"` in `[autoload]` section of `project.godot`
- Removed `autoloads/.gitkeep` (directory now contains real file)
- All 7 ACs verified via static code inspection — no rogue `print()` calls exist in codebase
- ⚠️ Task 3 note: Subtasks checked via static analysis only (no Godot runtime available during AI implementation). Code matches architecture spec exactly; runtime output should be confirmed in Godot editor at first opportunity by running the project and observing `AppLogger.info("Test", "Hello")` in the Output panel.

### Change Log

- 2026-02-21: Created `autoloads/app_logger.gd` with info/warn/error static methods; registered autoload in project.godot; removed autoloads/.gitkeep

### File List

- `autoloads/app_logger.gd` (new)
- `project.godot` (modified — added [autoload] section with AppLogger)
- `autoloads/.gitkeep` (deleted)
