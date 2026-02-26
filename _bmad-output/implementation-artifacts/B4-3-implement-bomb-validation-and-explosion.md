# Story B4.3: Implement Bomb Validation and Explosion

Status: review

## Story

As a server,
I want to authoritatively calculate bomb explosions,
so that clients cannot artificially destroy chests.

## Acceptance Criteria

1. **Stamina & Position Validation**: When `bomb_intent` is received, acquire lock `lock:hero_action:{tokenId}`. Verify the hero is at the specified `(x, y)` and has sufficient stamina (e.g., > 1.0).
2. **Stamina Drain**: If valid, drain stamina according to `Balance.STAMINA_DRAIN_PER_TICK` (authored by ST-B4.4).
3. **Intent Confirmation**: Emit `bomb_validated` to indicate the bomb was successfully placed and validated.
4. **Explosion Radius**: Calculate affected cells based on the hero's `bombRange` stat in a cross pattern.
5. **Chest Damage**: For each affected cell containing a chest:
   - Decrement chest HP in Redis `session:{userId}:grid`.
   - If HP <= 0, remove the chest and emit `chest_destroyed`.
6. **Lock Management**: Release the `lock:hero_action:{tokenId}` after processing.

## Tasks / Subtasks

- [x] Implement `HeroService` (AC: 1, 2)
  - [x] Implement stamina check and drain methods.
  - [x] Implement hero stat retrieval (power, range).
- [x] Update `GridService` (AC: 5)
  - [x] Implement `hitChest` method with Redis update logic.
- [x] Implement `bomb_intent` handler in `GameGateway` (AC: 1, 3, 4, 5, 6)
  - [x] Add distributed locking.
  - [x] Implement cross-pattern explosion logic.
  - [x] Emit confirmation and destruction events.

## Dev Notes

- **Architecture Patterns**: Follow the "Server-Authoritative Idle Loop" pattern. Client is a "dumb renderer".
- **Source Tree**:
  - `backend/src/treasure/hero.service.ts` (New)
  - `backend/src/treasure/grid.service.ts` (Modify)
  - `backend/src/game/game.gateway.ts` (Modify)
- **Testing**:
  - Mock Redis and Prisma for unit tests.
  - Ensure lock TTL is short (500ms) to prevent blocking the Hero AI loop.

### Project Structure Notes

- Aligns with the hybrid organization pattern (feature within type).
- `HeroService` placed in `treasure` module as it's tightly coupled with session-based grid logic.

### References

- [Epic B4: Treasure Session & Authoritative Logic](file:///d:/Godot/_bmad-output/epics/epic-B4-treasure-session.md)
- [Game Architecture: Server Authority](file:///d:/Godot/_bmad-output/game-architecture.md#L188-198)

## Change Log

- 2026-02-27: Initial implementation of authoritative bomb logic. (Claude Code)

## Dev Agent Record

### Agent Model Used

Claude Code (Haiku/Sonnet hybrid)

### Debug Log References

- Fixed `userId` type in `GridService` to `string` (UUID).
- Added `HeroService` to `TreasureModule` exports.

### Completion Notes List

- Implemented `HeroService` for hero stats and stamina drain.
- Implemented `GridService.hitChest` for Redis grid updates.
- Implemented `GameGateway.handleBombIntent` with locking, validation, and cross-pattern explosion.
- Added comprehensive unit tests for all new/modified logic.

### File List

- `backend/src/treasure/hero.service.ts`
- `backend/src/treasure/hero.service.spec.ts`
- `backend/src/treasure/grid.service.ts`
- `backend/src/treasure/grid.service.spec.ts`
- `backend/src/treasure/treasure.module.ts`
- `backend/src/game/game.gateway.ts`
- `backend/src/game/game.gateway.spec.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
