extends Node2D

var token_id: int
var stats: HeroData
var current_cell: Vector2i
var stamina_current: float
var is_resting: bool = false
var move_timer: float = 0.0
var active_bombs: int = 0

signal stamina_depleted
signal stamina_restored
signal moved_to_cell(cell: Vector2i)
signal bomb_placed(cell: Vector2i)

func initialize(p_token_id: int, p_stats: HeroData, spawn_cell: Vector2i) -> void:
	token_id = p_token_id
	stats = p_stats
	current_cell = spawn_cell
	stamina_current = float(stats.stamina * 10) # Max stamina = stat * 10
	position = Vector2(spawn_cell) * 32 # Assuming 32px tile size
	AppLogger.info("Hero", "Initialized", {"token_id": token_id, "cell": spawn_cell, "stamina": stamina_current})

func _process(delta: float) -> void:
	if is_resting:
		_restore_stamina(delta)
	else:
		move_timer += delta

func can_move() -> bool:
	return not is_resting and stamina_current >= Balance.STAMINA_DRAIN_PER_TICK

func can_place_bomb() -> bool:
	return not is_resting and active_bombs < stats.get_max_bombs() and stamina_current >= Balance.STAMINA_DRAIN_PER_TICK

func try_move(target_cell: Vector2i) -> bool:
	if not can_move():
		return false
	
	var move_interval := stats.get_move_interval()
	if move_timer < move_interval:
		return false
	
	# Drain stamina
	stamina_current -= Balance.STAMINA_DRAIN_PER_TICK
	move_timer = 0.0
	current_cell = target_cell
	
	# Check if depleted
	if stamina_current <= 0:
		stamina_current = 0
		is_resting = true
		stamina_depleted.emit()
		AppLogger.info("Hero", "Stamina depleted, entering rest", {"token_id": token_id})
	
	moved_to_cell.emit(target_cell)
	return true

func try_place_bomb() -> bool:
	if not can_place_bomb():
		return false
	
	stamina_current -= Balance.STAMINA_DRAIN_PER_TICK
	active_bombs += 1
	
	if stamina_current <= 0:
		stamina_current = 0
		is_resting = true
		stamina_depleted.emit()
	
	bomb_placed.emit(current_cell)
	return true

func on_bomb_exploded() -> void:
	active_bombs = maxi(0, active_bombs - 1)

func _restore_stamina(delta: float) -> void:
	var max_stamina := float(stats.stamina * 10)
	var restore_rate := 1.0 # 1 stamina per second when resting
	
	stamina_current = minf(stamina_current + restore_rate * delta, max_stamina)
	
	if stamina_current >= max_stamina:
		is_resting = false
		stamina_restored.emit()
		AppLogger.info("Hero", "Stamina restored", {"token_id": token_id})

func get_stamina_percent() -> float:
	var max_stamina := float(stats.stamina * 10)
	return stamina_current / max_stamina if max_stamina > 0 else 0.0
