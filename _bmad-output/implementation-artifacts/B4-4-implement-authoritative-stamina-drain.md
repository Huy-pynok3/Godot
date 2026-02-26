# Story B4.4: Implement Authoritative Stamina Drain

Status: done

## Story

As a server,
I want to track and drain hero stamina securely,
so that clients cannot manipulate their energy levels.

## Acceptance Criteria

1. **Persistent HeroService**: Enhance `HeroService` to manage full stamina lifecycle in Postgres via Prisma.
2. **Authoritative Drain**: On successful `bomb_intent` (triggered in `GameGateway`), decrement stamina by `HeroService.STAMINA_DRAIN_PER_BOMB`.
3. **Stamina Signal**: Emit `stamina_updated` via WebSocket to the session room when stamina changes.
4. **Action Rejection**: Ensure `bomb_intent` and `move_intent` are rejected if the hero has insufficient stamina (threshold: >= 1.0 for bombs).
5. **Lazy Regeneration**: Implement stamina recovery logic:
   - When hero data is fetched, calculate: `new_stamina = current_stamina + (current_time - last_update_time) * regen_rate`.
   - Update `staminaCurrent` and `lastUpdateTime` in the database.
   - Clamp `staminaCurrent` to the hero's `staminaMax` stat.

## Tasks / Subtasks

- [x] Implement Lazy Regeneration Logic in `HeroService` (AC: 5)
  - [x] Add `lastStaminaUpdate` field logic to Prisma queries.
  - [x] Implement calculation formula with clamping.
- [x] Update `HeroService.drainStamina` for full persistence (AC: 1, 2)
  - [x] Ensure DB update is atomic and handles the `staminaCurrent` decrement.
- [x] Integrate with `GameGateway` signals (AC: 3)
  - [x] Emit `stamina_updated` payload: `{ hero_id: number, stamina: number }`.
- [x] Implement stamina-based rejection for actions (AC: 4)
  - [x] Add check to `handleMoveIntent`.
  - [x] Refine check in `handleBombIntent`.

## Dev Notes

- **Architecture Patterns**: Followed the "Server-Authoritative Idle Loop" pattern.
- **Regeneration Rate**: Implemented at `0.5 / hour` as a static constant.
- **Source Tree**:
  - `backend/src/treasure/hero.service.ts`
  - `backend/src/game/game.gateway.ts`
  - `backend/prisma/schema.prisma` (Uses `lastRestTime` for tracking)
- **Testing**:
  - Comprehensive unit tests in `hero.service.spec.ts`.
  - Integration/Mock tests in `game.gateway.spec.ts`.

### Project Structure Notes

- `HeroService` methods now return updated model data to minimize DB roundtrips.

### References

- [Epic B4: Treasure Session & Authoritative Logic](file:///d:/Godot/_bmad-output/epics/epic-B4-treasure-session.md)
- [Game Architecture: State Authority Split](file:///d:/Godot/_bmad-output/game-architecture.md#L188-198)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Fixed a bug where `stamina_updated` wasn't emitted if the hero was already at max stamina (omitted DB update).
- Resolved a race condition in `move_intent` where stamina was checked after the lock was acquired but before validation.

### Completion Notes List

- Implemented `applyLazyRegeneration` using time-delta logic.
- Added `INSUFFICIENT_STAMINA` rejection reason.
- Verified WebSocket broadcast to session rooms.

### File List

- `backend/src/treasure/hero.service.ts`
- `backend/src/treasure/hero.service.spec.ts`
- `backend/src/game/game.gateway.ts`
- `backend/src/game/game.gateway.spec.ts`
- `backend/src/treasure/grid.service.ts`
- `backend/src/treasure/treasure.module.ts`
- `backend/src/redis/redis.service.ts`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
