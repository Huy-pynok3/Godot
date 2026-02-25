class_name GameGrid
extends Node

## Sentinel value used in _occupied to mark a cell as blocked by a chest (not a hero).
const CHEST_ID := -1
const HARD_BLOCK_ID := -2
const SOFT_BLOCK_ID := -3
## Sentinel returned by Dictionary.get() when a key is absent.
## Must be outside the valid range of hero/block/chest ids.
const _ABSENT := -999

## Maps Vector2i cell → int occupant id (hero_id, or CHEST_ID for chests).
## A cell absent from this dict is free.
var _occupied: Dictionary[Vector2i, int] = {}


## Returns true if cell is within grid bounds and has no occupant.
func is_cell_free(cell: Vector2i) -> bool:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "is_cell_free OOB", {"cell": cell})
		return false
	return not _occupied.has(cell)


## Optimistic reservation — called immediately on HeroAI tick before server confirms.
func reserve_cell(cell: Vector2i, hero_id: int) -> void:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "reserve_cell OOB", {"cell": cell, "hero_id": hero_id})
		return
	if _occupied.has(cell) and _occupied[cell] != hero_id:
		AppLogger.warn("GameGrid", "reserve_cell conflict — cell already occupied",
			{"cell": cell, "hero_id": hero_id, "occupant": _occupied[cell]})
	_occupied[cell] = hero_id


## Called after server confirms the move. No-op if reservation already matches.
func confirm_cell(cell: Vector2i, hero_id: int) -> void:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "confirm_cell OOB", {"cell": cell, "hero_id": hero_id})
		return
	if _occupied.get(cell, _ABSENT) == hero_id:
		return  # Already correctly reserved — no-op
	if _occupied.has(cell):
		AppLogger.warn("GameGrid", "confirm_cell conflict — overwriting occupant",
			{"cell": cell, "hero_id": hero_id, "actual": _occupied.get(cell, "empty")})
	_occupied[cell] = hero_id  # Server is authoritative; correct any mismatch


## Frees a cell. Only releases if the stored id matches hero_id to prevent
## accidentally releasing a cell owned by another hero or a chest.
func release_cell(cell: Vector2i, hero_id: int) -> void:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "release_cell OOB", {"cell": cell, "hero_id": hero_id})
		return
	if _occupied.get(cell, _ABSENT) != hero_id:
		AppLogger.warn("GameGrid", "release_cell mismatch — cell owned by different id",
			{"cell": cell, "hero_id": hero_id, "actual": _occupied.get(cell, "empty")})
		return
	_occupied.erase(cell)


## Returns a random free cell within grid bounds.
## Returns Vector2i(-1, -1) if no free cell is available.
func get_free_spawn_cell() -> Vector2i:
	var candidates: Array[Vector2i] = []
	for x in range(Constants.GRID_SIZE.x):
		for y in range(Constants.GRID_SIZE.y):
			var cell := Vector2i(x, y)
			if not _occupied.has(cell):
				candidates.append(cell)
	if candidates.is_empty():
		AppLogger.warn("GameGrid", "No free spawn cells available")
		return Vector2i(-1, -1)
	return candidates[randi() % candidates.size()]


## Marks a cell as blocked by a chest. Called by Chest node on spawn (ST-4.3).
func mark_chest_cell(cell: Vector2i) -> void:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "mark_chest_cell OOB", {"cell": cell})
		return
	_occupied[cell] = CHEST_ID


func mark_hard_block_cell(cell: Vector2i) -> void:
	if not _in_bounds(cell):
		return
	_occupied[cell] = HARD_BLOCK_ID


func mark_soft_block_cell(cell: Vector2i) -> void:
	if not _in_bounds(cell):
		return
	_occupied[cell] = SOFT_BLOCK_ID


func clear_all_cells() -> void:
	_occupied.clear()


## Unmarks a chest cell. Only erases if the stored value is CHEST_ID.
func unmark_chest_cell(cell: Vector2i) -> void:
	if not _in_bounds(cell):
		AppLogger.warn("GameGrid", "unmark_chest_cell OOB", {"cell": cell})
		return
	if _occupied.get(cell) == CHEST_ID:
		_occupied.erase(cell)


## Returns true if cell is within grid bounds [0, GRID_SIZE).
func _in_bounds(cell: Vector2i) -> bool:
	return cell.x >= 0 and cell.x < Constants.GRID_SIZE.x \
		and cell.y >= 0 and cell.y < Constants.GRID_SIZE.y
