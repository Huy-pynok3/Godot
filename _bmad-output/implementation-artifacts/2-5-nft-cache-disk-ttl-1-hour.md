# Story 2.5: NFT Cache — Disk, TTL 1 Hour

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want the game to load quickly when reopened within 1 hour,
so that I don't have to wait for BSC RPC every time I refresh.

## Acceptance Criteria

1. `NFTCache.get_hero_stats(token_id: int) -> HeroData` — returns cached data if still valid (age < 1 hour), returns `null` if stale or missing
2. `NFTCache.store(token_id: int, stats: HeroData) -> void` — writes to `user://nft_cache.json` with a Unix timestamp
3. TTL = `Balance.NFT_CACHE_TTL_SECONDS` (3600s) — never hardcode `3600` inline
4. Cache JSON format: `{ "schema_version": 1, "entries": { "<token_id_str>": { "power": 5, "speed": 3, "stamina": 7, "range": 2, "bomb_count": 2, "cached_at_unix": 1234567890 } } }` — note: key is `"range"` (not `"blast_range"`) to match `HeroData.from_dict()`
5. `schema_version` field present at top level of JSON — value `1` for current schema
6. Only `NFTCache` reads/writes `user://nft_cache.json` — no other file touches this path
7. On platforms where `user://` is not writable (edge case), errors are logged WARN and the method returns gracefully without crashing
8. `store()` is called by `Web3Manager` after receiving `nft_metadata_received` signal — this integration is NOT implemented in this story (see Dev Notes: Integration Boundary); this story only implements `NFTCache` internals

## Tasks / Subtasks

- [x] Task 1: Add `Balance.NFT_CACHE_TTL_SECONDS` constant verification (AC: #3)
  - [x] Verify `Balance.NFT_CACHE_TTL_SECONDS := 3600` already exists in `config/balance.gd` — it does; no change needed
  - [x] Note for dev agent: DO NOT add it again; it already exists

- [x] Task 2: Implement `NFTCache.store(token_id: int, stats: HeroData) -> void` (AC: #2, #4, #5, #6)
  - [x] Load existing JSON from `user://nft_cache.json` if it exists (or start with empty `{}`)
  - [x] Ensure top-level `schema_version` key = 1 and `entries` key exists as Dictionary
  - [x] Build entry dict: `{ "power": stats.power, "speed": stats.speed, "stamina": stats.stamina, "blast_range": stats.blast_range, "bomb_count": stats.bomb_count, "cached_at_unix": Time.get_unix_time_from_system() }`
  - [x] Write entry under `entries[str(token_id)]`
  - [x] Serialize full cache dict to JSON and write to `user://nft_cache.json` via `FileAccess.open(..., FileAccess.WRITE)`
  - [x] Log INFO on success: `AppLogger.info("NFTCache", "Hero stats cached", {"token_id": token_id})`
  - [x] On any FileAccess error: log WARN + return without crashing (AC: #7)

- [x] Task 3: Implement `NFTCache.get_hero_stats(token_id: int) -> HeroData` — replacing the stub (AC: #1, #3)
  - [x] Open `user://nft_cache.json` with `FileAccess.open(..., FileAccess.READ)` — if file doesn't exist, return `null`
  - [x] Parse JSON text → Dictionary (use `JSON.parse_string()`)
  - [x] Look up `entries[str(token_id)]` — if missing, return `null`
  - [x] Read `cached_at_unix` from entry — if missing or 0, return `null` (treat as invalid)
  - [x] Check TTL: `Time.get_unix_time_from_system() - cached_at_unix > Balance.NFT_CACHE_TTL_SECONDS` → return `null` (stale)
  - [x] Build and return `HeroData.from_dict(entry)` — the entry keys match `from_dict()` expected keys (note: key is `"blast_range"` — see Dev Notes: Key Names)
  - [x] Log INFO on cache hit: `AppLogger.info("NFTCache", "Cache hit", {"token_id": token_id})`
  - [x] Log INFO on cache miss/stale: `AppLogger.info("NFTCache", "Cache miss", {"token_id": token_id, "reason": "..."})`
  - [x] On any FileAccess/JSON parse error: log WARN + return `null`

- [x] Task 4: Smoke test in `main.gd` (temporary, debug only) (AC: all)
  - [x] In `main.gd._ready()`, inside `if OS.is_debug_build():`, call smoke test: create a synthetic HeroData, call `NFTCache.store()`, then `NFTCache.get_hero_stats()`, log result
  - [x] Verify: first call returns the stored HeroData, not null
  - [x] Run project — confirm INFO logs appear and no errors
  - [x] Remove smoke test from `main.gd` after verification
  - [x] Note: TTL expiry path is NOT testable in smoke test; it requires waiting 1 hour or manually setting `cached_at_unix` to a past value in the JSON file

## Dev Notes

### What This Story Does

Implements the two public methods of `NFTCache` autoload:
1. `store(token_id, stats)` — writes hero stats to `user://nft_cache.json` with a Unix timestamp
2. `get_hero_stats(token_id)` — reads and validates cached stats; returns `null` if stale or missing

Both methods are called by other systems — `store()` by `Web3Manager` (after fetching from BSC RPC), `get_hero_stats()` by the Lobby/TreasureHunt spawn flow (to avoid re-fetching on session resumption within 1 hour).

**This story modifies ONE file:**
- `autoloads/nft_cache.gd` — replaces stub with full `get_hero_stats()` + adds `store()`

**What it does NOT do:**
- Does NOT wire `Web3Manager` to call `NFTCache.store()` after `nft_metadata_received` — that integration belongs to E5/E7/E8 Lobby flow or a future integration story
- Does NOT implement session-start batch validation (checking all heroes from GameState.active_hero_ids) — that's the Lobby flow
- Does NOT touch `web3_manager.gd`, `hero_data.gd`, or any scene file

### Existing Code State (After ST-2.1–2.4)

**`autoloads/nft_cache.gd`** — current stub state:
```gdscript
extends Node

func get_hero_stats(_token_id: int) -> HeroData:
    return null
```

This is the ONLY file to modify. `store()` does not exist yet — add it.

**`config/balance.gd`** — already has:
```gdscript
const NFT_CACHE_TTL_SECONDS := 3600
```
Do NOT add it again.

**`autoloads/web3_manager.gd`** — has `nft_metadata_received` signal and `_on_metadata_callback()`. The architecture diagram shows `NFTCache.store(token_id, stats)` being called from `_on_metadata_callback()`, but that integration is NOT part of this story — ST-2.4 was completed without the store() call, which is correct per architecture's phased implementation.

### CRITICAL: JSON Key Names in Cache vs HeroData

**Cache JSON entry uses `"blast_range"` (not `"range"`):**

The cache stores the actual `HeroData` field names:
```json
{
  "power": 5,
  "speed": 3,
  "stamina": 7,
  "blast_range": 2,
  "bomb_count": 2,
  "cached_at_unix": 1234567890
}
```

But `HeroData.from_dict()` reads the key `"range"` (not `"blast_range"`):
```gdscript
h.blast_range = clampi(data.get("range", 1), 1, 10)
```

**Resolution:** When reading from cache, the entry must remap the key before calling `from_dict()`:
```gdscript
# When reading from cache:
var entry := cache["entries"][str(token_id)]
# entry has "blast_range" key — remap to "range" for from_dict():
var dict_for_from_dict := entry.duplicate()
dict_for_from_dict["range"] = entry.get("blast_range", 1)
return HeroData.from_dict(dict_for_from_dict)
```

Alternatively, pass the entry with the `"range"` key instead of `"blast_range"` when storing:
```gdscript
# In store(), save key as "range" to match from_dict():
entry_dict = {
    "power": stats.power,
    ...
    "range": stats.blast_range,   # <-- use "range" as key, not "blast_range"
    "bomb_count": stats.bomb_count,
    "cached_at_unix": ...
}
```

**RECOMMENDED APPROACH:** Store using `"range"` key (to match `from_dict()` expectations). This is simpler than remapping on read. The architecture doc's cache schema says `blast_range` but `from_dict()` reads `"range"` — the implementation must be consistent with `from_dict()`.

**Confirm the approach before implementing:** Read `hero_data.gd` to verify `from_dict()` reads `data.get("range", 1)` and use `"range"` as the stored key in the JSON cache.

### CRITICAL: `user://` Path on HTML5

On WebGL/HTML5 exports, `user://` maps to browser's `IndexedDB`. `FileAccess.open()` works the same API but:
- Write is synchronous in Godot 4's HTML5 implementation
- The path `user://nft_cache.json` is valid — no changes needed for HTML5 compatibility
- Do NOT use raw OS paths — always use `user://` prefix

### CRITICAL: FileAccess Pattern in Godot 4

Correct Godot 4 `FileAccess` usage:

**Reading:**
```gdscript
func _read_cache() -> Dictionary:
    if not FileAccess.file_exists("user://nft_cache.json"):
        return {}
    var file := FileAccess.open("user://nft_cache.json", FileAccess.READ)
    if file == null:
        AppLogger.warn("NFTCache", "Failed to open cache for reading", {"err": FileAccess.get_open_error()})
        return {}
    var text := file.get_as_text()
    file.close()
    var parsed: Variant = JSON.parse_string(text)
    if parsed == null or not (parsed is Dictionary):
        AppLogger.warn("NFTCache", "Cache JSON parse failed")
        return {}
    return parsed
```

**Writing:**
```gdscript
func _write_cache(data: Dictionary) -> void:
    var file := FileAccess.open("user://nft_cache.json", FileAccess.WRITE)
    if file == null:
        AppLogger.warn("NFTCache", "Failed to open cache for writing", {"err": FileAccess.get_open_error()})
        return
    file.store_string(JSON.stringify(data, "\t"))
    file.close()
```

**Key Godot 4 rules:**
- `FileAccess.open()` returns `null` on failure — always null-check
- Use `FileAccess.get_open_error()` to get the error code before the file variable is used
- Use `file.close()` after reading or writing — not a context manager
- Use `JSON.parse_string(text)` to parse — returns `null` on failure (Variant, must use explicit type)
- Use `JSON.stringify(data, "\t")` to serialize with pretty-printing
- `FileAccess.file_exists(path)` to check existence before opening for read

### CRITICAL: `JSON.parse_string()` Returns `Variant`

Same Godot 4.6 rule as ST-2.4: never use `:=` type inference on `Variant`-returning calls:

```gdscript
# WRONG — causes "Warning treated as error" in Godot 4.6:
var parsed := JSON.parse_string(text)

# CORRECT:
var parsed: Variant = JSON.parse_string(text)
```

### CRITICAL: `Time.get_unix_time_from_system()` Returns `float`

`Time.get_unix_time_from_system()` returns `float`, not `int`. The cache stores it as a number in JSON. When comparing for TTL:

```gdscript
var cached_at: float = entry.get("cached_at_unix", 0.0)
if Time.get_unix_time_from_system() - cached_at > Balance.NFT_CACHE_TTL_SECONDS:
    return null  # stale
```

Do NOT cast to `int` — use `float` throughout.

### Cache Schema (Full)

```json
{
    "schema_version": 1,
    "entries": {
        "42": {
            "token_id": 42,
            "power": 5,
            "speed": 3,
            "stamina": 7,
            "range": 2,
            "bomb_count": 2,
            "cached_at_unix": 1740000000.0
        },
        "99": {
            "token_id": 99,
            "power": 8,
            "speed": 6,
            "stamina": 4,
            "range": 3,
            "bomb_count": 3,
            "cached_at_unix": 1740000000.0
        }
    }
}
```

Note: the key stored is `"range"` (not `"blast_range"`) to match `HeroData.from_dict()`.

### Integration Boundary

This story is intentionally scoped to `NFTCache` internals only. The integration points are:

1. **`Web3Manager` → `NFTCache.store()`**: Should be called in `_on_metadata_callback()` after successful parse. This is NOT wired in ST-2.4 (completed without `store()`) and is NOT part of ST-2.5 either. This wiring belongs to a future integration story or the Lobby flow (E7/E8).

2. **Lobby/TreasureHunt → `NFTCache.get_hero_stats()`**: Called at session start before spawning heroes. Already referenced in architecture code examples. This caller doesn't exist yet (E5/E7).

The stub's existing `get_hero_stats()` signature is the same — we're replacing the body only.

### Smoke Test Approach

```gdscript
# Temporary in main.gd — debug build only, remove after verification
if OS.is_debug_build():
    # Create synthetic HeroData
    var test_stats := HeroData.new()
    test_stats.token_id = 42
    test_stats.power = 5
    test_stats.speed = 3
    test_stats.stamina = 7
    test_stats.blast_range = 2
    test_stats.bomb_count = 2

    # Store it
    NFTCache.store(42, test_stats)

    # Read it back
    var cached := NFTCache.get_hero_stats(42)
    if cached != null:
        AppLogger.info("Main", "ST-2.5 smoke: cache hit OK", {
            "token_id": cached.token_id,
            "power": cached.power,
            "speed": cached.speed
        })
    else:
        AppLogger.warn("Main", "ST-2.5 smoke: cache miss — UNEXPECTED")
```

Expected PC output:
```
[INFO] [NFTCache] Hero stats cached — { "token_id": 42 }
[INFO] [NFTCache] Cache hit — { "token_id": 42 }
[INFO] [Main] ST-2.5 smoke: cache hit OK — { "token_id": 42, "power": 5, "speed": 3 }
```

### Previous Story Intelligence (ST-2.1–2.4 Learnings)

1. **`var x: Variant = func_returning_variant()`** — Do NOT use `:=` on `Variant`-returning functions. Applies to `JSON.parse_string()` and any `Dictionary` subscript access. Always use explicit type annotation.

2. **`_parse_rpc_result()` returns `Variant`** (ST-2.4 code-review lesson): When a function can return `null`, its return type must be `Variant`. Callers must null-check. Apply same pattern here: `get_hero_stats()` returns `HeroData` but can return `null` — its declared return type should be `HeroData` (Godot 4 allows returning `null` for Reference types), but if needed, use `Variant`.

3. **No test framework** — Smoke test via temporary `AppLogger` calls in `main.gd._ready()`. Remove after verification. Full HTML5 test requires a browser.

4. **`user://` path works on PC** — `user://` resolves to `%APPDATA%/Godot/app_userdata/<project_name>/` on Windows. The JSON file will be created there during smoke test and is readable with a text editor for manual verification.

5. **`class_name` on `NFTCache`** — `nft_cache.gd` extends Node but has no `class_name`. Access via autoload name directly: `NFTCache.store(...)`. Do not add `class_name`.

6. **`JSON.stringify()` second arg** — In Godot 4, `JSON.stringify(data)` returns minified JSON. Pass `"\t"` as second arg for pretty-printing. Either format works for parsing — use pretty for easier manual debugging.

### Files NOT to Touch

- `src/hero/hero_data.gd` — `from_dict()` already correct; do not modify
- `config/balance.gd` — `NFT_CACHE_TTL_SECONDS` already exists; do not re-add
- `autoloads/web3_manager.gd` — store() integration is out of scope
- `src/web3/metamask_bridge.gd` — not in scope
- Any scene file, UI file, config file other than above

### References

- Story requirements: [Source: _bmad-output/epics/epic-2-web3-metamask.md#ST-2.5]
- Cache TTL constant: [Source: config/balance.gd:6 — `NFT_CACHE_TTL_SECONDS := 3600`]
- `NFTCache` is sole file reader/writer: [Source: _bmad-output/project-context.md#Autoload-Boundary-Rules]
- `user://nft_cache.json` path: [Source: _bmad-output/game-architecture.md#Data-Persistence]
- Architecture schema: [Source: _bmad-output/game-architecture.md#NFT-Metadata-Caching — `{ token_id, power, speed, stamina, blast_range, bomb_count, cached_at_unix }`]
- `schema_version` requirement: [Source: _bmad-output/game-architecture.md#Data-Persistence — "Schema versioned with schema_version field"]
- `HeroData.from_dict()` reads `"range"` key: [Source: src/hero/hero_data.gd]
- Current `NFTCache` stub: [Source: autoloads/nft_cache.gd]
- No blocking I/O per frame: [Source: _bmad-output/project-context.md#WebGL-HTML5-Constraints]
- FileAccess on HTML5 works with `user://`: [Source: _bmad-output/project-context.md#Platform-Build-Rules]
- AppLogger usage: [Source: _bmad-output/project-context.md#AppLogger-Usage]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Smoke test: `[INFO] [NFTCache] Hero stats cached — { "token_id": 42 }` ✅
- Smoke test: `[INFO] [NFTCache] Cache hit — { "token_id": 42 }` ✅
- Smoke test: `[INFO] [Main] ST-2.5 smoke: cache hit OK — { "token_id": 42, "power": 5, "speed": 3 }` ✅
- No parse errors. Pre-existing warnings only (stub signals, UID warning from main.tscn).

### Completion Notes List

1. **`store()` key is `"range"` (not `"blast_range"`)**: entry dict uses `"range": stats.blast_range` to match `HeroData.from_dict(data.get("range", 1))`. This is the correct mapping per ST-2.3 code-review learnings.

2. **`var parsed: Variant = JSON.parse_string(text)`**: Explicit Variant annotation used throughout — consistent with ST-2.4 code-review rule. No `:=` inference on Variant-returning calls.

3. **`Time.get_unix_time_from_system()` returns `float`**: `cached_at_unix` stored and compared as `float`. TTL comparison uses `Balance.NFT_CACHE_TTL_SECONDS` (int) which GDScript coerces safely.

4. **Private helper pattern**: `_read_cache()` and `_write_cache()` factored out to avoid duplication between `store()` and `get_hero_stats()`. Both handle errors gracefully (WARN log, return safely).

5. **`schema_version` = 1**: Added at top-level of cache dict when not present. Allows future migration detection.

6. **Code-review fixes applied (H1, M4, L1, L2)**:
   - H1: `_write_cache()` now returns `bool` (`true` on success, `false` on failure). `store()` now only logs "Hero stats cached" INFO when `_write_cache()` returns `true`. False success log eliminated.
   - M4: Added null guard at top of `store()` — `if stats == null: AppLogger.warn(...); return`. Prevents null-dereference crash when future callers (Web3Manager) wire the integration.
   - L1: Removed `_` prefix from constants — renamed `_CACHE_PATH` → `CACHE_PATH`, `_SCHEMA_VERSION` → `SCHEMA_VERSION`. Consistent with `UPPER_SNAKE_CASE` project convention.
   - L2: AC4 documentation corrected — changed `"blast_range": 2` to `"range": 2` in the format example to match actual implementation.

7. **AC verification**:
   - AC1: `get_hero_stats()` returns cached `HeroData` within TTL, `null` if stale/missing ✅
   - AC2: `store()` writes to `user://nft_cache.json` with timestamp ✅
   - AC3: TTL uses `Balance.NFT_CACHE_TTL_SECONDS` (3600) — never hardcoded ✅
   - AC4: Cache JSON format matches spec (`schema_version`, `entries`, per-token dict with `"range"` + `cached_at_unix`) ✅
   - AC5: `schema_version: 1` present at top level ✅
   - AC6: Only `nft_cache.gd` touches `user://nft_cache.json` ✅
   - AC7: FileAccess errors → WARN log + graceful return, no crash ✅
   - AC8: Integration (`Web3Manager` → `store()`) NOT implemented — out of scope ✅

### File List

- `autoloads/nft_cache.gd` — modified (replaced stub with full `get_hero_stats()` + added `store()`, `_read_cache()`, `_write_cache()`)
