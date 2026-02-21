# Story 1.4: Stub 5 Autoloads

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want all 5 autoloads stubbed with signals declared and registered in project.godot,
so that all future epics can connect to signals without errors even before full implementation exists.

## Acceptance Criteria

1. `autoloads/game_state.gd` exists with `extends Node`, `var wallet_address: String = ""`, `var active_hero_ids: Array[int] = []`, `var bcoin_balance: float = 0.0`
2. `autoloads/web3_manager.gd` exists with `extends Node` and signals: `wallet_connected(address: String)`, `wallet_error(message: String)`, `nft_metadata_received(token_id: int, stats: HeroData)`, `transaction_confirmed(tx_hash: String)`
3. `autoloads/server_api.gd` exists with `extends Node` and signals: `bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)`, `stamina_updated(hero_id: int, new_value: float)`, `reward_received(hero_id: int, bcoin_amount: float)`, `hero_move_confirmed(hero_id: int, new_position: Vector2i)`, `hero_move_rejected(hero_id: int)`, `connection_lost()`
4. `autoloads/nft_cache.gd` exists with `extends Node` and `func get_hero_stats(token_id: int) -> HeroData: return null`
5. `src/hero/hero_data.gd` exists as a **minimal stub** with `class_name HeroData` and `extends Resource` — required for typed signal/return-type resolution in Godot 4 at parse time
6. All 5 autoloads registered in `project.godot` `[autoload]` section in this exact order: `AppLogger`, `GameState`, `Web3Manager`, `ServerAPI`, `NFTCache`
7. Project runs without parse errors or crashes (all type references resolve)

## Tasks / Subtasks

- [x] Task 1: Create `src/hero/hero_data.gd` minimal stub (AC: #5) — do this FIRST before autoloads that reference HeroData
  - [x] `class_name HeroData`
  - [x] `extends Resource`
  - [x] No properties, no methods (stub only — full implementation in ST-2.3/5.x)
- [x] Task 2: Create `autoloads/game_state.gd` (AC: #1)
  - [x] `extends Node`
  - [x] `var wallet_address: String = ""`
  - [x] `var active_hero_ids: Array[int] = []`
  - [x] `var bcoin_balance: float = 0.0`
- [x] Task 3: Create `autoloads/web3_manager.gd` (AC: #2)
  - [x] `extends Node`
  - [x] `signal wallet_connected(address: String)`
  - [x] `signal wallet_error(message: String)`
  - [x] `signal nft_metadata_received(token_id: int, stats: HeroData)`
  - [x] `signal transaction_confirmed(tx_hash: String)`
- [x] Task 4: Create `autoloads/server_api.gd` (AC: #3)
  - [x] `extends Node`
  - [x] `signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)`
  - [x] `signal stamina_updated(hero_id: int, new_value: float)`
  - [x] `signal reward_received(hero_id: int, bcoin_amount: float)`
  - [x] `signal hero_move_confirmed(hero_id: int, new_position: Vector2i)`
  - [x] `signal hero_move_rejected(hero_id: int)`
  - [x] `signal connection_lost()`
- [x] Task 5: Create `autoloads/nft_cache.gd` (AC: #4)
  - [x] `extends Node`
  - [x] `func get_hero_stats(token_id: int) -> HeroData: return null`
- [x] Task 6: Register all 5 autoloads in `project.godot` (AC: #6)
  - [x] Add `GameState="*res://autoloads/game_state.gd"` after AppLogger
  - [x] Add `Web3Manager="*res://autoloads/web3_manager.gd"`
  - [x] Add `ServerAPI="*res://autoloads/server_api.gd"`
  - [x] Add `NFTCache="*res://autoloads/nft_cache.gd"`
  - [x] Verify AppLogger is still first in the list
  - [x] Verify `project.godot` is not malformed (config_version, application, rendering sections intact)

## Dev Notes

### What This Story Does

Stubs out the 4 remaining autoloads (AppLogger already done in ST-1.2) plus creates a minimal `HeroData` placeholder class. After this story, the entire autoload graph is wired up and future epics can safely `connect()` to any signal without instantiation errors.

### Critical: HeroData Must Be Created FIRST

`HeroData` is referenced as a **type** in:
- `Web3Manager.signal nft_metadata_received(token_id: int, stats: HeroData)`
- `NFTCache.func get_hero_stats(token_id: int) -> HeroData`

In Godot 4, GDScript resolves type annotations **at parse time**. If `HeroData` doesn't have a registered `class_name` when these files are parsed, Godot throws `Identifier "HeroData" not declared in the current scope`. This is a parse error, not a runtime error — the project will fail to load.

**Fix:** Create `src/hero/hero_data.gd` as a minimal stub **before** creating web3_manager.gd and nft_cache.gd:

```gdscript
# src/hero/hero_data.gd  ← CREATE THIS FIRST (Task 1)
class_name HeroData
extends Resource
```

This stub satisfies the parser. Full `HeroData` implementation (5 stats: power, speed, stamina, range, bomb_count) will be added in ST-2.3/5.x. Do NOT add any properties yet — they must come with the full design.

### Exact Stub Implementations

```gdscript
# autoloads/game_state.gd
extends Node

var wallet_address: String = ""
var active_hero_ids: Array[int] = []
var bcoin_balance: float = 0.0
```

```gdscript
# autoloads/web3_manager.gd
extends Node

signal wallet_connected(address: String)
signal wallet_error(message: String)
signal nft_metadata_received(token_id: int, stats: HeroData)
signal transaction_confirmed(tx_hash: String)
```

```gdscript
# autoloads/server_api.gd
extends Node

signal bomb_validated(hero_id: int, position: Vector2i, chest_destroyed: bool)
signal stamina_updated(hero_id: int, new_value: float)
signal reward_received(hero_id: int, bcoin_amount: float)
signal hero_move_confirmed(hero_id: int, new_position: Vector2i)
signal hero_move_rejected(hero_id: int)
signal connection_lost()
```

```gdscript
# autoloads/nft_cache.gd
extends Node

func get_hero_stats(token_id: int) -> HeroData:
	return null
```

### Registering Autoloads in project.godot

The `[autoload]` section must have all 5 entries. **Order matters** — AppLogger must be first because future stubs may log errors in `_ready()`. Add the 4 new entries after AppLogger:

```ini
[autoload]

AppLogger="*res://autoloads/app_logger.gd"
GameState="*res://autoloads/game_state.gd"
Web3Manager="*res://autoloads/web3_manager.gd"
ServerAPI="*res://autoloads/server_api.gd"
NFTCache="*res://autoloads/nft_cache.gd"
```

Verify the edit doesn't break the `[application]` or `[rendering]` sections that already exist.

### What is NOT in This Story (stubs only — defer to later epics)

| Feature | Lives in | Implemented in |
|---|---|---|
| `Web3Manager` wallet connect logic | Epic 2 (ST-2.2) | `autoloads/web3_manager.gd` |
| `Web3Manager._wallet_callback: JavaScriptObject` | Epic 2 | `autoloads/web3_manager.gd` |
| `ServerAPI` WebSocket connection | Epic 3 (ST-3.1) | `autoloads/server_api.gd` |
| `NFTCache` disk read/write | Epic 2 (ST-2.5) | `autoloads/nft_cache.gd` |
| `HeroData` properties (power, speed, etc.) | Epic 2/5 (ST-2.3) | `src/hero/hero_data.gd` |
| `GameState` `game_phase` tracking | Epic 8 | `autoloads/game_state.gd` |

Do NOT implement any of the above in this story — stubs only. Adding premature logic will cause code review to flag it as scope creep.

### Autoload Access Rules (Critical for All Future Stories)

```gdscript
# CORRECT — access by autoload name directly:
GameState.wallet_address
GameState.active_hero_ids
GameState.bcoin_balance
ServerAPI.bomb_validated.connect(_on_bomb_validated)

# WRONG — never do these:
get_node("/root/GameState").wallet_address   # Never use get_node for autoloads
var gs := GameState.new()                    # Never instantiate autoloads
```

### Load Order and _ready() Restriction

Godot loads autoloads in the order listed in `project.godot`. The order for this project is:
1. `AppLogger` — always first; logs parse errors for others
2. `GameState` — pure data holder; other autoloads read from it
3. `Web3Manager` — may need GameState in full implementation
4. `ServerAPI` — may need GameState in full implementation
5. `NFTCache` — reads/writes cache; may emit to Web3Manager

**Rule:** Never call another autoload's methods from `_ready()` — load order is sequential but `_ready()` calls can create ordering bugs. Since all stubs have NO `_ready()` in this story, this is not yet a risk.

### src/hero/ vs autoloads/ — Boundary Rule

`src/hero/hero_data.gd` goes in `src/hero/`, not in `autoloads/`. The `HeroData` Resource is a data class, not a singleton. It gets instantiated per-hero (15 instances during TreasureHunt). The `class_name` makes it globally accessible without being an autoload.

### Project Structure After This Story

```
autoloads/
  app_logger.gd       ← ST-1.2 (done)
  game_state.gd       ← ST-1.4 (this story)
  web3_manager.gd     ← ST-1.4 (this story)
  server_api.gd       ← ST-1.4 (this story)
  nft_cache.gd        ← ST-1.4 (this story)

src/hero/
  .gitkeep            ← will be replaced
  hero_data.gd        ← ST-1.4 minimal stub (this story)
```

Note: Remove `src/hero/.gitkeep` when creating `hero_data.gd` (same pattern as previous stories).

### Previous Story Learnings

- ST-1.3: Config classes use `class_name` without autoload — HeroData uses the same pattern (class_name + extends Resource, no autoload)
- ST-1.2: AppLogger stub had no `_ready()` — same pattern here (no lifecycle methods in stubs)
- ST-1.2/1.3: Runtime verification not possible in AI; note this in completion notes rather than claiming it was done
- ST-1.1/1.2 reviews: project.godot edits must preserve existing sections; verify after edit

### References

- Autoload signals (full typed spec): [Source: game-architecture.md#State-Management]
- Web3Manager signal names: [Source: game-architecture.md#Web3-MetaMask-Integration]
- ServerAPI signal names: [Source: game-architecture.md#Error-Handling] (reconnect example)
- GameState vars: [Source: game-architecture.md#State-Management]
- NFTCache stub: [Source: epics/epic-1-project-setup.md#ST-1.4]
- JavaScriptObject GC rule: [Source: project-context.md#JavaScriptBridge-CRITICAL] — deferred to Epic 2
- Autoload boundary rules: [Source: game-architecture.md#Architectural-Boundaries]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

None — stub files only; no runtime logic to debug.

### Completion Notes List

- Created `src/hero/hero_data.gd` FIRST (Task 1) as minimal stub: `class_name HeroData` + `extends Resource`. No properties or methods. Required before web3_manager.gd and nft_cache.gd to satisfy Godot 4 parse-time typed annotation resolution.
- Removed `src/hero/.gitkeep` (same pattern as ST-1.2/1.3).
- Created `autoloads/game_state.gd` with `extends Node` and 3 typed vars: `wallet_address: String`, `active_hero_ids: Array[int]`, `bcoin_balance: float`.
- Created `autoloads/web3_manager.gd` with `extends Node` and 4 typed signals (including `nft_metadata_received` with `HeroData` param type).
- Created `autoloads/server_api.gd` with `extends Node` and 6 typed signals.
- Created `autoloads/nft_cache.gd` with `extends Node` and `get_hero_stats(token_id: int) -> HeroData` stub returning null.
- Added 4 new autoload entries to `project.godot` [autoload] section after AppLogger. Load order: AppLogger → GameState → Web3Manager → ServerAPI → NFTCache. Verified `[application]` and `[rendering]` sections intact.
- All ACs verified via static code inspection. No Godot runtime available during AI implementation — runtime parse-error verification (AC #7) must be done by developer when opening project in Godot editor.
- No `_ready()` or lifecycle methods added to any stub — stubs are intentionally minimal.
- Godot auto-generated `.uid` files for each new script (5 files: hero_data.gd.uid, game_state.gd.uid, web3_manager.gd.uid, server_api.gd.uid, nft_cache.gd.uid) — documented in File List per ST-1.3 pattern.
- ⚠️ All new source files are untracked (not staged) in git — developer must manually stage and commit. `src/hero/.gitkeep` has `AD` git state (staged add from prior session, now deleted on disk); run `git rm --cached src/hero/.gitkeep` to clean if needed.

### Change Log

- 2026-02-21: Created hero_data.gd, game_state.gd, web3_manager.gd, server_api.gd, nft_cache.gd; updated project.godot [autoload]; removed src/hero/.gitkeep

### File List

- `src/hero/hero_data.gd` (new)
- `src/hero/hero_data.gd.uid` (new — Godot auto-generated)
- `src/hero/.gitkeep` (deleted)
- `autoloads/game_state.gd` (new)
- `autoloads/game_state.gd.uid` (new — Godot auto-generated)
- `autoloads/web3_manager.gd` (new)
- `autoloads/web3_manager.gd.uid` (new — Godot auto-generated)
- `autoloads/server_api.gd` (new)
- `autoloads/server_api.gd.uid` (new — Godot auto-generated)
- `autoloads/nft_cache.gd` (new)
- `autoloads/nft_cache.gd.uid` (new — Godot auto-generated)
- `project.godot` (modified — added GameState, Web3Manager, ServerAPI, NFTCache to [autoload])
