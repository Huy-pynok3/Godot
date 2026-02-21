class_name HeroData
extends Resource

@export var token_id: int
@export var power: int
@export var speed: int
@export var stamina: int
@export var blast_range: int
@export var bomb_count: int


func get_move_interval() -> float:
	return Balance.SPEED_BASE_INTERVAL - (speed * Balance.SPEED_STEP)


func get_max_bombs() -> int:
	return bomb_count


static func from_dict(data: Dictionary) -> HeroData:
	var h := HeroData.new()
	h.token_id   = data.get("token_id", 0)
	h.power      = clampi(data.get("power", 1), 1, 10)
	h.speed      = clampi(data.get("speed", 1), 1, 10)
	h.stamina    = clampi(data.get("stamina", 1), 1, 10)
	h.blast_range = clampi(data.get("range", 1), 1, 10)
	h.bomb_count = clampi(data.get("bomb_count", 1), 1, 5)
	return h
