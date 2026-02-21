extends Node

## NFT hero stat cache — reads/writes user://nft_cache.json with 1-hour TTL.
## ONLY this autoload may touch user://nft_cache.json (project-context.md rule).
## Cache JSON key for hero range stat is "range" (not "blast_range") to match
## HeroData.from_dict(), which reads data.get("range", 1).

const CACHE_PATH := "user://nft_cache.json"
const SCHEMA_VERSION := 1


## Returns cached HeroData for token_id if it exists and is within TTL.
## Returns null if stale, missing, or on any read/parse error.
func get_hero_stats(token_id: int) -> HeroData:
	var cache := _read_cache()
	var entries: Variant = cache.get("entries")
	if entries == null or not (entries is Dictionary):
		AppLogger.info("NFTCache", "Cache miss — no entries", {"token_id": token_id})
		return null
	var key := str(token_id)
	if not (entries as Dictionary).has(key):
		AppLogger.info("NFTCache", "Cache miss — key absent", {"token_id": token_id})
		return null
	var entry: Variant = (entries as Dictionary)[key]
	if not (entry is Dictionary):
		AppLogger.warn("NFTCache", "Cache entry malformed", {"token_id": token_id})
		return null
	var cached_at: float = (entry as Dictionary).get("cached_at_unix", 0.0)
	if Time.get_unix_time_from_system() - cached_at > Balance.NFT_CACHE_TTL_SECONDS:
		AppLogger.info("NFTCache", "Cache miss — stale", {"token_id": token_id})
		return null
	AppLogger.info("NFTCache", "Cache hit", {"token_id": token_id})
	return HeroData.from_dict(entry as Dictionary)


## Writes hero stats to cache with current Unix timestamp.
## Logs WARN on file I/O errors; logs INFO only on confirmed successful write.
## stats must not be null — callers are responsible for passing a valid HeroData.
func store(token_id: int, stats: HeroData) -> void:
	if stats == null:
		AppLogger.warn("NFTCache", "store() called with null stats — ignoring", {"token_id": token_id})
		return
	var cache := _read_cache()
	# Ensure top-level structure
	if not cache.has("schema_version"):
		cache["schema_version"] = SCHEMA_VERSION
	if not cache.has("entries") or not (cache["entries"] is Dictionary):
		cache["entries"] = {}
	var entry := {
		"token_id":        token_id,
		"power":           stats.power,
		"speed":           stats.speed,
		"stamina":         stats.stamina,
		"range":           stats.blast_range,   # key "range" matches HeroData.from_dict()
		"bomb_count":      stats.bomb_count,
		"cached_at_unix":  Time.get_unix_time_from_system(),
	}
	(cache["entries"] as Dictionary)[str(token_id)] = entry
	if _write_cache(cache):
		AppLogger.info("NFTCache", "Hero stats cached", {"token_id": token_id})


# ── Private helpers ───────────────────────────────────────────────────────────

func _read_cache() -> Dictionary:
	if not FileAccess.file_exists(CACHE_PATH):
		return {}
	var file := FileAccess.open(CACHE_PATH, FileAccess.READ)
	if file == null:
		AppLogger.warn("NFTCache", "Failed to open cache for reading", {"err": FileAccess.get_open_error()})
		return {}
	var text := file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(text)
	if parsed == null or not (parsed is Dictionary):
		AppLogger.warn("NFTCache", "Cache JSON parse failed — returning empty cache")
		return {}
	return parsed as Dictionary


## Returns true on successful write, false on any error.
func _write_cache(data: Dictionary) -> bool:
	var file := FileAccess.open(CACHE_PATH, FileAccess.WRITE)
	if file == null:
		AppLogger.warn("NFTCache", "Failed to open cache for writing", {"err": FileAccess.get_open_error()})
		return false
	file.store_string(JSON.stringify(data, "\t"))
	file.close()
	return true
