---
epic: B3
story: 2
title: "Define Protocol DTOs"
status: "done"
---

# Story B3.2: Define Protocol DTOs

## Story Foundation

**As a** backend developer,
**I want** to strongly type all incoming WebSocket messages,
**So that** invalid data cannot reach the core game logic.

**Acceptance Criteria:**
- Define TypeScript classes (DTOs) for incoming intents: `MoveIntentDto` (`hero_id`, `x`, `y`) and `BombIntentDto` (`hero_id`, `x`, `y`).
- Use `@nestjs/websockets` decorators (`@MessageBody`, `@ConnectedSocket`) in the gateway handlers.
- Apply `class-validator` decorators (`@IsInt`, `@IsPositive`, etc.) to the DTOs.
- Configure a `ValidationPipe` to automatically reject malformed intent objects before they hit the handler logic.

## Developer Context

### Technical Requirements

- **Framework:** NestJS WebSocket implementation (Socket.IO).
- **Validation:** Use `class-validator` and `class-transformer`.
- **DTOs Required:**
  - `MoveIntentDto`: Needs `hero_id` (integer), `x` (integer), `y` (integer).
  - `BombIntentDto`: Needs `hero_id` (integer), `x` (integer), `y` (integer).
- **Validation Pipe:** The gateway must be configured to use a `ValidationPipe` that throws `WsException` on validation errors. Note that the standard HTTP `ValidationPipe` throws HTTP exceptions; a custom WS-specific exception factory might be needed, or ensure the global/gateway pipe handles WS contexts correctly.

### Architecture Compliance

- **Server-Authoritative Pattern:** The client sends *intents*, not commands. The DTOs must reflect this (e.g., `MoveIntentDto`, not `MoveCommandDto`).
- **Data Types:** Godot's `Vector2i` translates to separate `x` and `y` integer fields in JSON. Ensure strict integer validation (`@IsInt()`).

### Library/Framework Requirements

- `@nestjs/websockets`, `@nestjs/platform-socket.io`
- `class-validator`, `class-transformer`
- Ensure the `ValidationPipe` is properly scoped to the WebSocket gateway or handlers using `@UsePipes(new ValidationPipe({...}))`.

### File Structure Requirements

- DTOs should be placed in `backend/src/game/dto/`.
- `move-intent.dto.ts`
- `bomb-intent.dto.ts`
- Handlers in `backend/src/game/game.gateway.ts` (stub the `@SubscribeMessage` handlers to apply the DTOs and decorators).

### Testing Requirements

- Write unit tests for the DTO validation rules (e.g., passing invalid types, missing fields, or negative coordinates if applicable to the grid).
- Write tests in `game.gateway.spec.ts` verifying that the handlers use the DTOs (even if the handlers are just stubs for now).

## Previous Story Intelligence

From ST-B3.1:
- The `GameGateway` is already set up in `backend/src/game/game.gateway.ts` with authentication and Redis session tracking.
- Client connections are authenticated manually in `handleConnection`.
- You will be adding `@SubscribeMessage` handlers and `@UsePipes` to this existing gateway.

## Latest Tech Information

- NestJS WebSocket Validation: When using `ValidationPipe` with WebSockets, validation errors typically result in a silent failure or an unhandled exception that might crash the connection. Best practice is to pass a custom `exceptionFactory` to the `ValidationPipe` or use a custom `WsValidationPipe` that throws a `WsException`, which Socket.IO translates to an error acknowledgment or event back to the client.

## Project Context Reference

- The game is a 2D grid-based game. The grid coordinates (`x`, `y`) are integers. Validation should ensure they are integers (`@IsInt()`).
- Hero IDs are integers.

## Tasks / Subtasks

- [x] Task 1: Create Protocol DTOs
  - [x] Create `MoveIntentDto` with `hero_id`, `x`, `y` decorated with `class-validator` attributes.
  - [x] Create `BombIntentDto` with `hero_id`, `x`, `y` decorated with `class-validator` attributes.
  - [x] Write unit tests validating these rules for both DTOs.
- [x] Task 2: Update Gateway Implementation
  - [x] Apply `@UsePipes(new ValidationPipe({...}))` globally to the `GameGateway` handling WsExceptions.
  - [x] Add `@SubscribeMessage` handlers for `move_intent` and `bomb_intent`.
  - [x] Write unit tests in `game.gateway.spec.ts` asserting handlers run correctly with valid payloads.

## Dev Agent Record

### Implementation Plan

1.  **DTO Definitions:** Add standard `MoveIntentDto` and `BombIntentDto` within `backend/src/game/dto/`. Validate strictly for integer payload fields using `class-validator`. Added `@Min(0)` to `hero_id` based on code review findings.
2.  **WebSocket Gateway Update:**
    *   Decorate `GameGateway` with `@UsePipes` using NestJS `ValidationPipe`, overriding the default `exceptionFactory` to return `WsException` for graceful error propagation on the socket. (And also enabling `transform: true`).
    *   Add `@SubscribeMessage` handlers for `move_intent` and `bomb_intent` responding correctly with placeholders based on the incoming DTO data.
3.  **Testing:** Build test suites for DTO validation checks, and verify correct parsing/emission on `GameGateway`. Added explicit checks for negative `hero_id`s in tests.

### Completion Notes

- ✅ Added `MoveIntentDto` and `BombIntentDto` with `@IsInt()` and `@IsNotEmpty()` strict validation. Added `@Min(0)` constraints to `hero_id` fields per code review.
- ✅ Overrode the `ValidationPipe` exception factory at the gateway level to emit `WsException` ensuring client connection isn't dropped inappropriately on validation failure. Added `transform: true` to ensure incoming numeric strings are correctly handled if they slip through socket.io serialization, though primarily we're relying on strict types.
- ✅ Successfully handled and stubbed WebSocket subscription logic for `move_intent` and `bomb_intent`.
- ✅ All test suites passing.
- ✅ Resolved code review findings related to payload data sanitization (transform) and missing edge-case validation limits.

## Change Log

- Added DTO definitions for `move_intent` and `bomb_intent` with strict validation rules.
- Added a `ValidationPipe` to the `GameGateway` using a custom exception factory to handle validation errors by wrapping them in `WsException`s.
- Added stubbed handlers on `GameGateway` to acknowledge `move_intent` and `bomb_intent` requests.
- Added unit tests for validation rules and gateway intent handlers.

## File List

- `backend/src/game/dto/move-intent.dto.ts` (New)
- `backend/src/game/dto/bomb-intent.dto.ts` (New)
- `backend/src/game/dto/move-intent.dto.spec.ts` (New)
- `backend/src/game/dto/bomb-intent.dto.spec.ts` (New)
- `backend/src/game/game.gateway.ts` (Modified)
- `backend/src/game/game.gateway.spec.ts` (Modified)
- `_bmad-output/implementation-artifacts/B3-2-define-protocol-dtos.md` (Modified)