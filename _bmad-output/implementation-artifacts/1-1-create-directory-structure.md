# Story 1.1: Create Directory Structure

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the full project directory structure created exactly per the architecture specification,
so that every AI agent knows exactly where to place new files without ambiguity.

## Acceptance Criteria

1. The following directories exist at `res://` level:
   - `autoloads/`
   - `config/`
   - `scenes/lobby/`
   - `scenes/treasure_hunt/`
   - `scenes/rest/`
   - `src/core/`
   - `src/hero/`
   - `src/map/`
   - `src/bomb/`
   - `src/ui/`
   - `src/web3/`
   - `assets/sprites/heroes/`
   - `assets/sprites/map/`
   - `assets/sprites/bomb/`
   - `assets/audio/sfx/`
   - `assets/audio/music/`
   - `assets/ui/`
   - `debug/`
2. No directory from the architecture specification is missing.
3. Each folder contains a `.gitkeep` (or equivalent placeholder) so Git tracks empty folders.
4. The `project.godot` file has the **Compatibility** renderer set (NOT Forward+).

## Tasks / Subtasks

- [x] Task 1: Create all top-level directories (AC: #1)
  - [x] Create `autoloads/`
  - [x] Create `config/`
  - [x] Create `scenes/`
  - [x] Create `src/`
  - [x] Create `assets/`
  - [x] Create `debug/`
- [x] Task 2: Create all sub-directories (AC: #1)
  - [x] Create `scenes/lobby/`
  - [x] Create `scenes/treasure_hunt/`
  - [x] Create `scenes/rest/`
  - [x] Create `src/core/`
  - [x] Create `src/hero/`
  - [x] Create `src/map/`
  - [x] Create `src/bomb/`
  - [x] Create `src/ui/`
  - [x] Create `src/web3/`
  - [x] Create `assets/sprites/heroes/`
  - [x] Create `assets/sprites/map/`
  - [x] Create `assets/sprites/bomb/`
  - [x] Create `assets/audio/sfx/`
  - [x] Create `assets/audio/music/`
  - [x] Create `assets/ui/`
- [x] Task 3: Add `.gitkeep` placeholder to each empty directory (AC: #3)
- [x] Task 4: Verify `project.godot` renderer is set to Compatibility (AC: #4)
  - [x] Open Project Settings > Rendering > Renderer and confirm "Compatibility" is selected
  - [x] If it shows "Forward Plus", switch to Compatibility and save

## Dev Notes

### What This Story Does

This story is purely structural — no GDScript logic is written. It establishes the canonical project directory layout so that all subsequent stories (ST-1.2 through ST-1.6 and all later epics) know exactly where to place new files.

The architecture uses a **hybrid organization pattern**: top-level folders separate by artifact type (`autoloads/`, `scenes/`, `src/`, `assets/`); within `src/` folders are organized by game system/feature (`src/hero/`, `src/map/`, etc.).

### Renderer Setting — CRITICAL

The project **must** use the **Compatibility renderer**, not Forward+. This is a hard requirement for WebGL/HTML5 export (primary platform).

- In `project.godot`, the relevant line should be:
  ```
  config/features=PackedStringArray("4.6", "gl_compatibility")
  ```
  NOT `"Forward Plus"`.
- If the project was created with Forward+, go to **Project > Project Settings > Rendering > Renderer** and switch to Compatibility before proceeding.
- Never introduce Forward+ or Vulkan-specific features anywhere in this project.

### Project Structure Notes

#### Canonical Directory Layout (from Architecture)

```
res://
├── autoloads/                  # All 5 Autoload singletons (app_logger.gd, game_state.gd, web3_manager.gd, server_api.gd, nft_cache.gd)
├── config/                     # Static config classes (constants.gd, balance.gd, network.gd) — read-only at runtime
├── scenes/
│   ├── main.tscn               # Root scene (to be created in ST-1.5)
│   ├── lobby/
│   │   └── lobby.tscn          # (to be created in ST-7.1)
│   ├── treasure_hunt/
│   │   └── treasure_hunt.tscn  # (to be created later)
│   └── rest/
│       └── rest.tscn           # (to be created in ST-7.4)
├── src/
│   ├── core/                   # main.gd, game_phase_state_machine.gd
│   ├── hero/                   # hero.gd, hero_ai.gd, hero_data.gd (+ hero_factory.gd)
│   ├── map/                    # grid_map.gd, chest.gd
│   ├── bomb/                   # bomb.gd
│   ├── ui/                     # hud.gd, hero_card.gd, lobby_ui.gd, rest_ui.gd
│   └── web3/                   # metamask_bridge.gd ONLY — only imported by Web3Manager autoload
├── assets/
│   ├── sprites/
│   │   ├── heroes/
│   │   ├── map/
│   │   └── bomb/
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   └── ui/
└── debug/                      # debug_panel.tscn — NEVER imported by production code paths
```

#### Architectural Boundary Rules (Enforced by Directory Structure)

These boundaries are established by this story and must be respected by ALL future stories:

| Boundary | Rule |
|---|---|
| `autoloads/` | Only the 5 defined singletons. Never add new autoloads without architectural approval. |
| `src/web3/` | Only `metamask_bridge.gd`. Only imported by `autoloads/web3_manager.gd`. |
| `config/` | Read-only at runtime. No code writes to config files. Values are GDScript `const`. |
| `debug/` | Never imported by production code paths. Always gated by `OS.is_debug_build()`. |
| `scenes/ ↔ src/` | Each `.tscn` has exactly one root `.gd` script in the matching `src/` subfolder. |

#### Naming Conventions (for future file creation)

| Artifact | Convention | Example |
|---|---|---|
| GDScript files | `snake_case.gd` | `hero_ai.gd`, `server_api.gd` |
| Scene files | `snake_case.tscn` | `treasure_hunt.tscn` |
| Sprite assets | `subject_state_frame.png` | `hero_idle_01.png`, `chest_open.png` |
| Audio files | `subject_action.ogg` | `bomb_explode.ogg`, `bcoin_earn.ogg` |

### Git Tracking of Empty Directories

Godot 4 respects standard `.gitkeep` files. Add one to each directory created:

```bash
# Example for each empty directory:
touch autoloads/.gitkeep
touch config/.gitkeep
touch scenes/lobby/.gitkeep
# ... etc.
```

Alternatively, Godot projects often leave directories empty until first use — verify with the team preference. If the project uses a `.gdignore` in assets or debug, preserve that.

### No Code Written in This Story

This story creates **zero GDScript files** and **zero scene files**. The directory structure is the deliverable. Files will be created in subsequent stories:

- `autoloads/*.gd` → ST-1.2, ST-1.4
- `config/*.gd` → ST-1.3
- `scenes/main.tscn` + `src/core/main.gd` → ST-1.5
- `debug/debug_panel.tscn` → ST-1.6

### References

- Full directory structure: [Source: game-architecture.md#Directory-Structure]
- Renderer requirement (Compatibility for WebGL): [Source: project-context.md#Technology-Stack]
- Architectural boundary rules: [Source: game-architecture.md#Architectural-Boundaries]
- Naming conventions: [Source: game-architecture.md#Naming-Conventions]
- Epic 1 acceptance criteria (all directories): [Source: epics/epic-1-project-setup.md#ST-1.1]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — structural-only story, no code execution.

### Completion Notes List

- Created 18 required game directories (plus intermediate: `scenes/`, `src/`, `assets/`, `assets/sprites/`, `assets/audio/`) — 23 total
- Added `.gitkeep` to every directory (23 files) so Git tracks all empty folders
- Fixed `project.godot`: changed renderer from `"Forward Plus"` to `"gl_compatibility"` — both in `config/features` and the `[rendering]` section
- Removed `rendering_device/driver.windows="d3d12"` (D3D12 is Forward+/Vulkan only; Compatibility uses OpenGL)
- Validation: all 18 AC-required dirs confirmed present; grep confirms zero "Forward Plus" in project.godot

### Senior Developer Review (AI)

**Review Date:** 2026-02-21
**Reviewer Model:** claude-opus-4-6
**Review Outcome:** Approve (with fixes applied)

**Findings Summary:** 0 Critical, 3 Medium (fixed), 3 Low (accepted)

**Action Items:**
- [x] [Med] Fix project name: "Godot" → "BombCrypto Remake" in `project.godot:13`
- [x] [Med] Remove unnecessary Jolt Physics 3D config from `project.godot:17-19`
- [x] [Med] Add `.gdignore` to `_bmad/` and `_bmad-output/` to prevent 15+ unwanted `.import` files
- [ ] [Low] Redundant `.gitkeep` in 5 intermediate directories (accepted — not harmful)
- [ ] [Low] `sprint-status.yaml` not in story File List (accepted — workflow meta-file)
- [ ] [Low] `.gitkeep` minor editor noise (accepted — negligible)

### Change Log

- 2026-02-21: Created full project directory structure per architecture spec; switched renderer to Compatibility for WebGL export
- 2026-02-21: Code review fixes — renamed project to "BombCrypto Remake", removed Jolt 3D physics, added .gdignore to _bmad/ and _bmad-output/

### File List

- `autoloads/.gitkeep` (new)
- `config/.gitkeep` (new)
- `scenes/.gitkeep` (new)
- `scenes/lobby/.gitkeep` (new)
- `scenes/treasure_hunt/.gitkeep` (new)
- `scenes/rest/.gitkeep` (new)
- `src/.gitkeep` (new)
- `src/core/.gitkeep` (new)
- `src/hero/.gitkeep` (new)
- `src/map/.gitkeep` (new)
- `src/bomb/.gitkeep` (new)
- `src/ui/.gitkeep` (new)
- `src/web3/.gitkeep` (new)
- `assets/.gitkeep` (new)
- `assets/sprites/.gitkeep` (new)
- `assets/sprites/heroes/.gitkeep` (new)
- `assets/sprites/map/.gitkeep` (new)
- `assets/sprites/bomb/.gitkeep` (new)
- `assets/audio/.gitkeep` (new)
- `assets/audio/sfx/.gitkeep` (new)
- `assets/audio/music/.gitkeep` (new)
- `assets/ui/.gitkeep` (new)
- `debug/.gitkeep` (new)
- `project.godot` (modified — renderer: Forward Plus → gl_compatibility, name: Godot → BombCrypto Remake, removed Jolt Physics 3D)
- `_bmad/.gdignore` (new — prevents Godot editor from importing non-game files)
- `_bmad-output/.gdignore` (new — prevents Godot editor from importing non-game files)
