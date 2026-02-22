# Story B2.3: Create Auth Guard

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want a reusable JWT authorization guard,
so that I can easily secure REST and WebSocket endpoints.

## Acceptance Criteria

1. Create a NestJS `@Injectable() class JwtAuthGuard`.
2. Validates the `Authorization: Bearer <token>` header against the `JWT_SECRET`.
3. Injects the decoded user payload into the request object (`req.user`).
4. Rejects requests lacking a token or with an invalid/expired token with `401 Unauthorized`.

## Tasks / Subtasks

- [x] Task 1: Create JwtAuthGuard (AC: #1, #2, #4)
  - [x] Implement `JwtAuthGuard` in `backend/src/auth/guards/jwt-auth.guard.ts`.
  - [x] Inject `JwtService` and `ConfigService` into the guard.
  - [x] Extract token from the request header (`Authorization: Bearer <token>`).
  - [x] Verify the token using `JwtService.verifyAsync()` with the `JWT_SECRET`.
  - [x] Throw `UnauthorizedException` if token is missing, invalid, or expired.
- [x] Task 2: Inject Payload (AC: #3)
  - [x] Attach the decoded token payload to `request.user` to make it accessible to controllers.
- [x] Task 3: Create WsJwtGuard (Bonus / Preparation for WebSockets)
  - [x] Implement a similar guard for WebSockets (`WsJwtGuard`) that extracts the token from the handshake auth payload or query string, handling `WsException` instead of `HttpException`.
- [x] Task 4: Write Unit Tests
  - [x] Write unit tests for `JwtAuthGuard` verifying successful extraction, validation, injection, and proper exception throwing.

## Dev Notes

### Architecture Patterns
- **NestJS Guards:** We are building a standard NestJS Guard (`CanActivate`) to protect routes.
- **Stateless Auth:** JWTs provide stateless authentication. The guard only needs to verify the signature using the secret. No database lookup is strictly required for basic auth, although extending it to check user status (banned/deleted) might be a future consideration.

### Source Tree
- `backend/src/auth/guards/jwt-auth.guard.ts` (New)
- `backend/src/auth/guards/ws-jwt.guard.ts` (New)

### Dependencies
- `@nestjs/jwt` and `@nestjs/config` are already installed and configured in `AuthModule`.

## Dev Agent Record

### Completion Notes
✅ Implemented `JwtAuthGuard` to validate Bearer tokens and protect REST endpoints.
✅ Implemented `WsJwtGuard` as a bonus/preparation to protect WebSocket gateways, pulling tokens from auth payloads, queries, or headers.
✅ Wrote full unit test coverage for both guards, verifying validation logic and payload extraction. Fixed a testing reference issue where the `request`/`client` reference in tests wasn't mutating correctly.
✅ (Code Review Fix): Added missing exports and providers in `AuthModule` to allow `JwtAuthGuard`, `WsJwtGuard` and `JwtModule` to be injected globally across other modules.

### File List
- `backend/src/auth/guards/jwt-auth.guard.ts` (New)
- `backend/src/auth/guards/jwt-auth.guard.spec.ts` (New)
- `backend/src/auth/guards/ws-jwt.guard.ts` (New)
- `backend/src/auth/guards/ws-jwt.guard.spec.ts` (New)
- `backend/src/auth/auth.module.ts` (Modified)

### Change Log
- Created JWT and WebSocket guards for NestJS endpoints.
- Exported guards from `AuthModule` to be reused system-wide.

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.

## References

- [Source: _bmad-output/epics/epic-B2-auth.md#ST-B2.3]
- [Source: _bmad-output/game-architecture.md]
