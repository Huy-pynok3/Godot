extends Node

func info(system: String, msg: String, data: Dictionary = {}) -> void:
	if OS.is_debug_build():
		print("[INFO] [%s] %s — %s" % [system, msg, str(data)])

func warn(system: String, msg: String, data: Dictionary = {}) -> void:
	push_warning("[WARN] [%s] %s — %s" % [system, msg, str(data)])

func error(system: String, msg: String, data: Dictionary = {}) -> void:
	push_error("[ERROR] [%s] %s — %s" % [system, msg, str(data)])
