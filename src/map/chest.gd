class_name Chest
extends Node2D

@onready var _anim: AnimationPlayer = $AnimationPlayer

var _cell: Vector2i
var _game_grid: GameGrid
var _initialized: bool = false


func _ready() -> void:
	_setup_animations()
	ServerAPI.bomb_validated.connect(_on_bomb_validated)


func _exit_tree() -> void:
	if ServerAPI.bomb_validated.is_connected(_on_bomb_validated):
		ServerAPI.bomb_validated.disconnect(_on_bomb_validated)


## Called by the spawner (TreasureHunt) after add_child().
## Positions the chest on the grid and marks the cell as occupied.
func initialize(cell: Vector2i, game_grid: GameGrid, grid_visual: GridVisual) -> void:
	_cell = cell
	_game_grid = game_grid
	position = grid_visual.cell_to_pixel(cell) + grid_visual.tile_size / 2
	game_grid.mark_chest_cell(cell)
	_initialized = true
	AppLogger.info("Chest", "Chest initialized", {"cell": cell})


func _on_bomb_validated(hero_id: int, bomb_position: Vector2i, chest_destroyed: bool) -> void:
	if not _initialized:
		return
	if bomb_position != _cell:
		return
	if not chest_destroyed:
		return
	_game_grid.unmark_chest_cell(_cell)
	_anim.animation_finished.connect(_on_destroy_animation_finished, CONNECT_ONE_SHOT)
	_anim.play("destroy")
	AppLogger.info("Chest", "Chest destroyed", {"cell": _cell, "hero_id": hero_id})


func _on_destroy_animation_finished(_anim_name: StringName) -> void:
	queue_free()


## Creates idle and destroy animations programmatically.
func _setup_animations() -> void:
	var lib := AnimationLibrary.new()

	# idle — empty looping animation, 1 second
	var idle := Animation.new()
	idle.length = 1.0
	idle.loop_mode = Animation.LOOP_LINEAR
	lib.add_animation("idle", idle)

	# destroy — fade alpha 1.0 → 0.0 over 0.5 seconds
	var destroy := Animation.new()
	destroy.length = 0.5
	destroy.loop_mode = Animation.LOOP_NONE
	var track_idx := destroy.add_track(Animation.TYPE_VALUE)
	destroy.track_set_path(track_idx, "Sprite2D:modulate:a")
	destroy.track_insert_key(track_idx, 0.0, 1.0)
	destroy.track_insert_key(track_idx, 0.5, 0.0)
	lib.add_animation("destroy", destroy)

	_anim.add_animation_library("", lib)
	_anim.play("idle")

