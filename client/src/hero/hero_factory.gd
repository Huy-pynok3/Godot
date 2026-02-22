class_name HeroFactory
extends Object

const _HERO_SCENE = preload("res://scenes/treasure_hunt/hero.tscn")

## Creates a new Hero node instance from the provided parameters.
## This function does NOT add the node to the scene tree. The caller is responsible for that.
##
## @param token_id The unique NFT token ID of the hero.
## @param stats The HeroData resource containing the hero's stats. This MUST be a unique instance for this hero.
## @param spawn_cell The grid coordinate to spawn the hero at.
## @return The instantiated Hero node, or null if instantiation fails.
static func create(token_id: int, stats: HeroData, spawn_cell: Vector2i) -> Node:
	if not _HERO_SCENE:
		AppLogger.error("HeroFactory", "Failed to load hero.tscn", {})
		return null

	var hero = _HERO_SCENE.instantiate()

	if not hero:
		AppLogger.error("HeroFactory", "Failed to instantiate hero", {"token_id": token_id})
		return null

	if hero.has_method("initialize"):
		hero.initialize(token_id, stats, spawn_cell)
	else:
		AppLogger.error("HeroFactory", "Hero scene is missing initialize method", {"token_id": token_id})

	return hero
