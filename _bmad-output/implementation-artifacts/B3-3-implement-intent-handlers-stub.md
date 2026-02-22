---
epic: B3
story: 3
title: "Implement Intent Handlers (Stub)"
status: "ready-for-dev"
---

# Story B3.3: Implement Intent Handlers (Stub)

## Story Foundation

**As a** real-time client,
**I want** to send intents and receive basic responses,
**So that** I can test the end-to-end WebSocket loop.

**Acceptance Criteria:**
- Implement `@SubscribeMessage('move_intent')` and `@SubscribeMessage('bomb_intent')`.
- Inside the handler, parse the DTO and immediately emit a placeholder response back to the client.
- For `move_intent`, emit `hero_move_confirmed` with the received `x` and `y`.
- For `bomb_intent`, emit `bomb_validated` with the received `x` and `y`.
- Implement a `@SubscribeMessage('heartbeat')` handler that silently accepts the message to keep the connection alive.

## Developer Context

### Technical Requirements

- **Framework:** NestJS WebSockets
- **Handlers:**
  - `move_intent` -> `hero_move_confirmed`
  - `bomb_intent` -> `bomb_validated`
  - `heartbeat` -> No response required, just acknowledge.

### Architecture Compliance

- **Server-Authoritative Loop:** This story sets up the foundational loop (Client Intent -> Server Validates -> Server Confirms). While validation is currently a stub (always confirms), the data flow must perfectly match the architecture document.

### File Structure Requirements

- `backend/src/game/game.gateway.ts` (Existing)

### Testing Requirements

- Add tests in `backend/src/game/game.gateway.spec.ts` asserting that `heartbeat` is handled. (The other two handlers already have basic tests from B3.2, but ensure they are complete).

## Previous Story Intelligence

From ST-B3.2:
- The DTOs (`MoveIntentDto`, `BombIntentDto`) are already created with strict validation (`@IsInt()`, `@Min(0)`).
- The `ValidationPipe` is already active on the gateway.
- Stubs for `move_intent` and `bomb_intent` were already partially implemented during the DTO testing phase! You may just need to verify they meet the ACs perfectly and add the `heartbeat` handler.

## Project Context Reference

- Refer to the "Server-Authoritative Idle Loop" pattern in the architecture document for the exact signal names expected by the client.

## Dev Agent Record

### Implementation Plan

1.  **Handlers Validation & Logic Completion**: Review the existing stub handlers for `move_intent` and `bomb_intent`. I noticed they were mostly correct but we needed to emit `hero_id` back in the response objects as defined by the server architecture document.
2.  **Heartbeat Handler**: Ensure the `heartbeat` handler exists and properly accepts messages silently without broadcasting them.
3.  **Testing**: Verify `game.gateway.spec.ts` covers the heartbeat and the updated DTO responses in the handlers.
4.  **Final Verification**: Run `npm run test` to guarantee coverage.

### Completion Notes

- ✅ Updated `handleMoveIntent` to emit `{ hero_id, x, y }` payload matching expected client protocol.
- ✅ Updated `handleBombIntent` to emit `{ hero_id, x, y, chest_destroyed }` payload matching expected client protocol.
- ✅ Verified `handleHeartbeat` exists and silently ignores heartbeats appropriately.
- ✅ Updated unit tests in `game.gateway.spec.ts` for handlers checking the precise updated DTO emissions.
- ✅ All tests run perfectly successfully.

## Change Log

- Modified `handleMoveIntent` to emit the `hero_id` back to the client.
- Modified `handleBombIntent` to emit `hero_id` and a stubbed `chest_destroyed` boolean to the client.
- Modified unit tests `handleMoveIntent` and `handleBombIntent` in `game.gateway.spec.ts` to expect the updated properties payload.

## File List

- `backend/src/game/game.gateway.ts`
- `backend/src/game/game.gateway.spec.ts`