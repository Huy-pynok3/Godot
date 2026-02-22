---
epic: B3
title: "WebSocket Gateway & Protocol"
status: "backlog"
priority: "high"
depends_on: ["B1", "B2"]
---

# Epic B3: WebSocket Gateway & Protocol

## Objective
Establish the bidirectional, real-time communication channel (WebSocket) between the Godot client and the authoritative NestJS server.

## Definition of Done (DoD)
- [ ] WebSocket server starts automatically with NestJS on the `/game` path.
- [ ] Client connections authenticate via a JWT (passed in the connection payload or query param).
- [ ] Server correctly handles `move_intent` and `bomb_intent` messages.
- [ ] Server can push events (`hero_move_confirmed`, `hero_move_rejected`, `bomb_validated`) back to the client.
- [ ] Unknown or malformed messages are safely ignored.

## User Stories

### ST-B3.1 — Setup WebSocket Gateway
**As a** real-time client,
**I want** to connect to a secure WebSocket endpoint,
**So that** I can send rapid intents and receive game state updates.

**Acceptance Criteria:**
- Use `@nestjs/platform-ws` (or `socket.io`) to create a `@WebSocketGateway({ namespace: 'game' })`.
- Handle `handleConnection` and `handleDisconnect` events.
- Implement an authentication interceptor that extracts the JWT from the `auth.token` or `query.token` and validates it before accepting the connection.
- Reject connections missing a valid JWT.
- Associate the socket connection ID with the user's database ID in memory or Redis.

### ST-B3.2 — Define Protocol DTOs
**As a** backend developer,
**I want** to strongly type all incoming WebSocket messages,
**So that** invalid data cannot reach the core game logic.

**Acceptance Criteria:**
- Define TypeScript classes (DTOs) for incoming intents: `MoveIntentDto` (`hero_id`, `x`, `y`) and `BombIntentDto` (`hero_id`, `x`, `y`).
- Use `@nestjs/websockets` decorators (`@MessageBody`, `@ConnectedSocket`) in the gateway handlers.
- Apply `class-validator` decorators (`@IsInt`, `@IsPositive`) to the DTOs.
- Configure a `ValidationPipe` to automatically reject malformed intent objects before they hit the handler logic.

### ST-B3.3 — Implement Intent Handlers (Stub)
**As a** real-time client,
**I want** to send intents and receive basic responses,
**So that** I can test the end-to-end WebSocket loop.

**Acceptance Criteria:**
- Implement `@SubscribeMessage('move_intent')` and `@SubscribeMessage('bomb_intent')`.
- Inside the handler, parse the DTO and immediately emit a placeholder response back to the client.
- For `move_intent`, emit `hero_move_confirmed` with the received `x` and `y`.
- For `bomb_intent`, emit `bomb_validated` with the received `x` and `y`.
- Implement a `@SubscribeMessage('heartbeat')` handler that silently accepts the message to keep the connection alive.