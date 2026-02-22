class_name GamePhaseStateMachine
extends Node

enum Phase { LOBBY, TREASURE_HUNT, REST }

var current_phase: Phase = Phase.LOBBY

func transition_to(new_phase: Phase) -> void:
	AppLogger.info("GamePhaseStateMachine", "Phase transition", {
		from = Phase.keys()[current_phase],
		to = Phase.keys()[new_phase]
	})
	current_phase = new_phase
