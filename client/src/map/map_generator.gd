class_name MapGenerator
extends RefCounted

## Procedural map generator for BombCrypto-style Treasure Hunt.
## Produces deterministic output for the same seed.

const HARD_BLOCK_ID := -2
const SOFT_BLOCK_ID := -3

static func generate(seed: int, grid_size: Vector2i, chest_count: int = 24) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed

	var cols := grid_size.x
	var rows := grid_size.y

	var hard := {}
	var soft := {}

	# 1) Base structure: border + checker hard blocks (classic bomber layout)
	for x in range(cols):
		for y in range(rows):
			var is_border := x == 0 or y == 0 or x == cols - 1 or y == rows - 1
			if is_border or (x % 2 == 0 and y % 2 == 0):
				hard[Vector2i(x, y)] = true

	# 2) Open horizontal corridors every few rows for a more maze-like map
	for y in range(1, rows - 1):
		if y % 4 == 1:
			for x in range(1, cols - 1):
				hard.erase(Vector2i(x, y))

	# 3) Fill empty cells with soft blocks at controlled density
	for x in range(1, cols - 1):
		for y in range(1, rows - 1):
			var c := Vector2i(x, y)
			if hard.has(c):
				continue
			if rng.randf() < 0.42:
				soft[c] = true

	# 4) Keep safe zones around 4 corners for hero spawn
	var hero_spawns: Array[Vector2i] = [
		Vector2i(1, 1),
		Vector2i(cols - 2, 1),
		Vector2i(1, rows - 2),
		Vector2i(cols - 2, rows - 2),
	]
	var safe_cells: Array[Vector2i] = []
	for spawn in hero_spawns:
		safe_cells.append(spawn)
		safe_cells.append(spawn + Vector2i(1, 0))
		safe_cells.append(spawn + Vector2i(-1, 0))
		safe_cells.append(spawn + Vector2i(0, 1))
		safe_cells.append(spawn + Vector2i(0, -1))

	for c in safe_cells:
		hard.erase(c)
		soft.erase(c)

	# 5) Chests are spawned inside a subset of soft cells
	var soft_cells: Array[Vector2i] = []
	for c in soft.keys():
		soft_cells.append(c)
	soft_cells.shuffle()

	var chests: Array[Vector2i] = []
	var limit := mini(chest_count, soft_cells.size())
	for i in range(limit):
		chests.append(soft_cells[i])

	return {
		"hard_blocks": hard.keys(),
		"soft_blocks": soft.keys(),
		"chest_cells": chests,
		"hero_spawns": hero_spawns,
	}
