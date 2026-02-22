# Story B3.1: Setup WebSocket Gateway

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a real-time client,
I want to connect to a secure WebSocket endpoint,
so that I can send rapid intents and receive game state updates.

## Acceptance Criteria

1. Use `@nestjs/platform-ws` (or `socket.io`) to create a `@WebSocketGateway({ namespace: 'game' })`.
2. Handle `handleConnection` and `handleDisconnect` events.
3. Implement an authentication interceptor/guard that extracts the JWT from the `auth.token`, `query.token` or headers and validates it before accepting the connection.
4. Reject connections missing a valid JWT with an appropriate exception.
5. Associate the socket connection ID with the user's database ID in memory or Redis.

## Tasks / Subtasks

- [x] Task 1: Initialize WebSocket Gateway (AC: #1, #2)
  - [x] Generate a `GameGateway` class decorated with `@WebSocketGateway({ namespace: 'game' })`.
  - [x] Implement `OnGatewayConnection` and `OnGatewayDisconnect` lifecycle interfaces.
  - [x] Add basic logging for client connections and disconnections.
- [x] Task 2: Secure WebSocket Connections (AC: #3, #4)
  - [x] Utilize the previously created `WsJwtGuard` (from Epic B2) to secure the gateway or handle token verification directly in the `handleConnection` lifecycle method. (Note: Guards don't automatically trigger on the initial handshake in NestJS, so you must manually verify the token using `JwtService` inside `handleConnection` or use an adapter/middleware).
  - [x] Reject the connection if the token is invalid or missing by calling `client.disconnect()`.
- [x] Task 3: Store Connection State (AC: #5)
  - [x] Upon successful connection and token verification, map the user's `walletAddress` or `userId` (from the JWT payload) to the socket `client.id`.
  - [x] Store this mapping in `RedisService` to track active sessions across potential server instances.
  - [x] Remove the mapping from `RedisService` in `handleDisconnect`.
- [x] Task 4: Write Unit Tests
  - [x] Write tests verifying that valid connections are accepted and mapped in Redis.
  - [x] Write tests verifying that invalid connections are immediately disconnected.

## Dev Notes

### Architecture Patterns
- **WebSocket Gateway:** Using NestJS WebSocket implementation (defaults to `socket.io`).
- **Connection Lifecycle Security:** NestJS Guards (`@UseGuards`) only trigger on incoming *messages* (`@SubscribeMessage`), not on the initial connection handshake. You MUST manually verify the JWT using `JwtService` inside `handleConnection(client)` before allowing the client to stay connected.
- **State Management:** Tracking connected sockets in Redis is crucial for the server-authoritative architecture to push events back to specific players later.

### Source Tree
- `backend/src/game/game.gateway.ts` (New)
- `backend/src/game/game.module.ts` (New)

### Dependencies
- `@nestjs/websockets` and `@nestjs/platform-socket.io` are required. (Check `package.json` to ensure they are installed, install if missing).

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.
- A new `GameModule` should be created to house the gateway and game logic, keeping it separate from the `AuthModule`.

## References

- [Source: _bmad-output/epics/epic-B3-websocket.md#ST-B3.1]
- [Source: _bmad-output/game-architecture.md]

## Dev Agent Record

### Agent Model Used
Gemini 3.1 Pro

### Completion Notes List
- Comprehensive context engine analysis completed - developer guide created for setting up the WebSocket gateway, including explicit instructions on the NestJS handshake security caveat.
- ✅ Implemented `GameGateway` under the `/game` namespace.
- ✅ Handled WebSocket connection events using `OnGatewayConnection` and `OnGatewayDisconnect`.
- ✅ Extracted JWT token directly during `handleConnection` and verified it manually since Guards don't fire during the initial socket connection.
- ✅ Successfully stored mapping of `walletAddress` to `socket.id` inside Redis to keep track of active sessions.
- ✅ Handled graceful disconnection by clearing the user's mapping from Redis on `handleDisconnect`.
- ✅ Full unit test suite created to assert auth validation on connection and session management logic.

### File List
- `_bmad-output/implementation-artifacts/B3-1-setup-websocket-gateway.md` (Modified)
- `backend/src/game/game.module.ts` (New)
- `backend/src/game/game.gateway.ts` (New)
- `backend/src/game/game.gateway.spec.ts` (New)
- `backend/src/app.module.ts` (Modified)
