class_name TreasureHunt
extends Node2D

const _CHEST_SCENE = preload("res://scenes/treasure_hunt/chest.tscn")

@export var procedural_seed: int = 20260226
@export var initial_chest_count: int = 26

@onready var _game_grid: GameGrid = $GameGrid
@onready var _grid_visual: GridVisual = $GridVisual


func _ready() -> void:
	_generate_initial_map()
	ServerAPI.chest_spawned.connect(_on_chest_spawned)


func _exit_tree() -> void:
	if ServerAPI.chest_spawned.is_connected(_on_chest_spawned):
		ServerAPI.chest_spawned.disconnect(_on_chest_spawned)


func _generate_initial_map() -> void:
	var layout := MapGenerator.generate(procedural_seed, Constants.GRID_SIZE, initial_chest_count)
	var hard_blocks: Array = layout.get("hard_blocks", [])
	var soft_blocks: Array = layout.get("soft_blocks", [])
	var chest_cells: Array = layout.get("chest_cells", [])

	_game_grid.clear_all_cells()
	for cell in hard_blocks:
		_game_grid.mark_hard_block_cell(cell)
	for cell in soft_blocks:
		_game_grid.mark_soft_block_cell(cell)

	_grid_visual.set_map_layout(hard_blocks, soft_blocks, chest_cells)

	for cell in chest_cells:
		_spawn_chest(cell)

	AppLogger.info("TreasureHunt", "Procedural map generated", {
		"seed": procedural_seed,
		"hard": hard_blocks.size(),
		"soft": soft_blocks.size(),
		"chests": chest_cells.size(),
	})


func _spawn_chest(cell: Vector2i) -> void:
	var chest := _CHEST_SCENE.instantiate() as Chest
	if not chest:
		AppLogger.error("TreasureHunt", "Failed to instantiate Chest scene")
		return
	add_child(chest)
	chest.initialize(cell, _game_grid, _grid_visual)


func _on_chest_spawned(cell: Vector2i) -> void:
	var target_cell := cell
	if not _game_grid.is_cell_free(cell):
		AppLogger.warn("TreasureHunt", "chest_spawned cell occupied — finding fallback",
			{"requested": cell})
		target_cell = _game_grid.get_free_spawn_cell()
		if target_cell == Vector2i(-1, -1):
			AppLogger.error("TreasureHunt", "No free cell for chest spawn — dropping")
			return
	_spawn_chest(target_cell)
	AppLogger.info("TreasureHunt", "Chest spawned", {"cell": target_cell, "fallback": target_cell != cell})
