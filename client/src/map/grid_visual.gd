class_name GridVisual
extends Node2D

const _COLOR_EVEN := Color(0.15, 0.15, 0.15)
const _COLOR_ODD  := Color(0.20, 0.20, 0.20)

## Pixel size of each grid cell, computed from viewport in _ready().
## Zero until _ready() fires — do not call cell_to_pixel/pixel_to_cell before then.
var tile_size: Vector2


func _ready() -> void:
	var vp := get_viewport_rect().size
	tile_size = Vector2(vp.x / Constants.GRID_SIZE.x, vp.y / Constants.GRID_SIZE.y)
	queue_redraw()


func _draw() -> void:
	if tile_size == Vector2.ZERO:
		return
	for x in range(Constants.GRID_SIZE.x):
		for y in range(Constants.GRID_SIZE.y):
			var color := _COLOR_EVEN if (x + y) % 2 == 0 else _COLOR_ODD
			draw_rect(Rect2(Vector2(x, y) * tile_size, tile_size), color)


## Returns the top-left pixel position of a grid cell.
## Heroes, Chests, and Bombs add tile_size / 2 to center themselves.
## WARNING: Returns Vector2.ZERO for all cells if called before _ready().
func cell_to_pixel(cell: Vector2i) -> Vector2:
	return Vector2(cell) * tile_size


## Returns the grid cell that contains the given pixel position.
## Out-of-bounds pixel coords return out-of-bounds cells — validate with GameGrid._in_bounds().
## WARNING: Division by zero if called before _ready() (tile_size is Vector2.ZERO).
func pixel_to_cell(pixel: Vector2) -> Vector2i:
	if tile_size == Vector2.ZERO:
		AppLogger.warn("GridVisual", "pixel_to_cell called before _ready — tile_size is zero")
		return Vector2i(-1, -1)
	return Vector2i(pixel / tile_size)

