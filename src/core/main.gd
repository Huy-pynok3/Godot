extends Node

func _ready() -> void:
	AppLogger.info("Main", "Game started")
	if OS.is_debug_build():
		var panel_scene = load("res://debug/debug_panel.tscn")
		if panel_scene:
			add_child(panel_scene.instantiate())
		else:
			AppLogger.warn("Main", "DebugPanel scene not found — will be added in ST-1.6")

