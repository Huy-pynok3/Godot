extends Control

func _ready() -> void:
	AppLogger.info("DebugPanel", "Debug panel ready — F1 toggle, F2 dump GameState")

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F1:
			visible = !visible
		elif event.keycode == KEY_F2:
			_dump_game_state()

func _dump_game_state() -> void:
	AppLogger.info("DebugPanel", "GameState dump", {
		wallet_address = GameState.wallet_address,
		active_hero_ids = GameState.active_hero_ids,
		bcoin_balance = GameState.bcoin_balance
	})
