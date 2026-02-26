extends Node2D
class_name Bomb

var cell_position: Vector2i
var blast_range: int
var owner_token_id: int
var explosion_timer: float = 3.0 # 3 seconds to explode

signal exploded(cell: Vector2i, range: int, owner_id: int)

func initialize(p_cell: Vector2i, p_range: int, p_owner_id: int) -> void:
	cell_position = p_cell
	blast_range = p_range
	owner_token_id = p_owner_id
	position = Vector2(p_cell) * 32
	AppLogger.info("Bomb", "Placed", {"cell": p_cell, "range": p_range, "owner": p_owner_id})

func _process(delta: float) -> void:
	explosion_timer -= delta
	if explosion_timer <= 0:
		explode()

func explode() -> void:
	AppLogger.info("Bomb", "Exploded", {"cell": cell_position, "range": blast_range})
	exploded.emit(cell_position, blast_range, owner_token_id)
	queue_free()

func get_affected_cells() -> Array[Vector2i]:
	var cells: Array[Vector2i] = []
	cells.append(cell_position) # Center
	
	# Four directions
	for dir in [Vector2i.UP, Vector2i.DOWN, Vector2i.LEFT, Vector2i.RIGHT]:
		for i in range(1, blast_range + 1):
			var target := cell_position + dir * i
			cells.append(target)
	
	return cells
