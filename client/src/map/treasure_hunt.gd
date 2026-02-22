class_name TreasureHunt
extends Node2D

const _CHEST_SCENE = preload("res://scenes/treasure_hunt/chest.tscn")

@onready var _game_grid: GameGrid = $GameGrid
@onready var _grid_visual: GridVisual = $GridVisual


func _ready() -> void:
	ServerAPI.chest_spawned.connect(_on_chest_spawned)


func _exit_tree() -> void:
	if ServerAPI.chest_spawned.is_connected(_on_chest_spawned):
		ServerAPI.chest_spawned.disconnect(_on_chest_spawned)


func _on_chest_spawned(cell: Vector2i) -> void:
	var target_cell := cell
	if not _game_grid.is_cell_free(cell):
		AppLogger.warn("TreasureHunt", "chest_spawned cell occupied — finding fallback",
			{"requested": cell})
		target_cell = _game_grid.get_free_spawn_cell()
		if target_cell == Vector2i(-1, -1):
			AppLogger.error("TreasureHunt", "No free cell for chest spawn — dropping")
			return
	var chest := _CHEST_SCENE.instantiate() as Chest
	if not chest:
		AppLogger.error("TreasureHunt", "Failed to instantiate Chest scene")
		return

	add_child(chest)
	chest.initialize(target_cell, _game_grid, _grid_visual)
	AppLogger.info("TreasureHunt", "Chest spawned", {"cell": target_cell, "fallback": target_cell != cell})
