# Story 5.1: HeroFactory

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a TreasureHunt scene,
I want to spawn a hero from `HeroData` with a single command,
so that the scene parent doesn't need to know the internal setup details of the Hero node.

## Acceptance Criteria

1. `HeroFactory` static class exists in `src/hero/hero_factory.gd`.
2. `HeroFactory.create(token_id: int, stats: HeroData, spawn_cell: Vector2i) -> Hero` is implemented.
3. Hero node is instantiated from `res://scenes/treasure_hunt/hero.tscn`.
4. `hero.initialize(token_id, stats, spawn_cell)` is called within the factory before returning.
5. The factory DOES NOT call `add_child()` — the caller (parent scene) is responsible for adding the node to the tree.
6. Each hero receives its own `HeroData` instance (confirmed via `project-context.md` Resource rule).
7. Basic error handling: logs ERROR and returns `null` if instantiation fails.

## Tasks / Subtasks

- [ ] Task 1: Create `src/hero/hero_factory.gd` (AC: #1, #2, #3, #4, #5, #6, #7)
  - [ ] Implement `class_name HeroFactory` extends `Object` (or just a static class).
  - [ ] `const _HERO_SCENE = preload("res://scenes/treasure_hunt/hero.tscn")`
  - [ ] Implement `static func create(...) -> Hero`
  - [ ] Add null guards and `AppLogger` error if scene fails to instantiate.
  - [ ] Call `hero.initialize()` with provided params.

## Dev Notes

### Architecture Patterns
- **Resource Rule:** "Never share a single `HeroData` instance between multiple heroes — each hero gets its own instance." (Source: `project-context.md:65`)
- **Factory Pattern:** The factory should be a "pure" creator. It prepares the node but leaves the tree management to the caller.
- **Autoload Boundary:** `HeroFactory` is a static helper, not an autoload.

### Source Tree
- `src/hero/hero_factory.gd` (New)
- `scenes/treasure_hunt/hero.tscn` (Requirement for ST-5.2, but stub needed here for Task 1)

### Dependencies
- This story provides the entry point for Epic 5. Subsequent stories (ST-5.2) will implement the `Hero` node and the `initialize()` method.

## Project Structure Notes

- **Path:** `src/hero/hero_factory.gd` aligns with `project-context.md` directory rules.
- **Naming:** `HeroFactory` (PascalCase class), `create` (snake_case method).

## References

- [Source: _bmad-output/epics/epic-5-hero-ai.md#ST-5.1]
- [Source: _bmad-output/project-context.md#Resources]
- [Source: _bmad-output/project-context.md#Asset-Loading]

## Dev Agent Record

### Agent Model Used

gemini-3-flash

### Debug Log References

### Completion Notes List

### File List
- `src/hero/hero_factory.gd` (created)
