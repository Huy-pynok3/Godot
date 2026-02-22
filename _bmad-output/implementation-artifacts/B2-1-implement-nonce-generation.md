# Story B2.1: Implement Nonce Generation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a client,
I want to request a cryptographic nonce linked to my wallet address,
so that I can sign it to prove ownership.

## Acceptance Criteria

1. Create `POST /auth/nonce` endpoint.
2. Accepts `{ "walletAddress": "0x..." }`.
3. Generates a random alphanumeric nonce (e.g., using `crypto.randomBytes`).
4. Caches the nonce in Redis as `user:{wallet}:nonce` with a 5-minute expiration (TTL).
5. Returns `{ "nonce": "the_nonce_string" }`.

## Tasks / Subtasks

- [x] Task 1: Setup Auth Module and Controller (AC: #1, #2)
  - [x] Generate NestJS `AuthModule`, `AuthController`, and `AuthService` in `backend/src/auth/`
  - [x] Import `RedisModule` into `AuthModule` to enable caching the nonce
  - [x] Create a DTO for the request: `NonceRequestDto` containing `walletAddress` (string, required, should be a valid Ethereum address format). Add `class-validator` and `class-transformer` if not already installed.
  - [x] Define the `POST /auth/nonce` endpoint in `AuthController` accepting `NonceRequestDto`
- [x] Task 2: Implement Nonce Generation Logic (AC: #3)
  - [x] In `AuthService`, implement a method `generateNonce(walletAddress: string): Promise<string>`
  - [x] Use Node.js built-in `crypto` module (e.g., `crypto.randomBytes(32).toString('hex')`) to generate a secure random alphanumeric string.
- [x] Task 3: Cache Nonce in Redis (AC: #4, #5)
  - [x] Inject `RedisService` into `AuthService`
  - [x] In `generateNonce`, save the generated nonce to Redis using the key format `user:{walletAddress.toLowerCase()}:nonce`. *CRITICAL*: Always lowercase the wallet address when building the key to prevent case-sensitivity issues during signature verification later.
  - [x] Set a TTL of 300 seconds (5 minutes) for the Redis key.
  - [x] Return the generated nonce from the controller method in the format `{ "nonce": "the_nonce_string" }`.
- [x] Task 4: Write Unit Tests
  - [x] Write unit tests for `AuthController` checking endpoint mapping and response format
  - [x] Write unit tests for `AuthService` verifying nonce generation, lowercasing of the wallet address for the Redis key, and correct Redis `set` call with TTL

## Dev Notes

### Architecture Patterns
- **Redis Caching:** We use the `RedisService` built in Story B1.3 to store the nonce. This ensures the nonce is available across horizontally scaled instances (if deployed that way) and handles expiration natively via TTL.
- **Wallet Address Normalization:** Ethereum addresses can be mixed case (checksummed) or all lowercase. It is *vital* that the Redis key normalizes the address (e.g., `.toLowerCase()`) so that the subsequent verification step can find the nonce regardless of how the client formats the address in the login request.

### Source Tree
- `backend/src/auth/auth.module.ts` (New)
- `backend/src/auth/auth.controller.ts` (New)
- `backend/src/auth/auth.service.ts` (New)
- `backend/src/auth/dto/nonce-request.dto.ts` (New)

### Dependencies
- Story B1.3 (Configure Redis Module) is completed and `RedisService` is available.
- Need to install `class-validator` and `class-transformer` in `backend/` if not already present, and ensure global validation pipes are enabled in `main.ts` (if not already done).

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.

## References

- [Source: _bmad-output/epics/epic-B2-auth.md#ST-B2.1]
- [Source: _bmad-output/game-architecture.md]

## Dev Agent Record

### Agent Model Used

gemini-3.1-pro-high

### Debug Log References

### Completion Notes List
- Generated AuthModule, AuthController, and AuthService
- Created NonceRequestDto to enforce wallet address validation using `class-validator` and regex
- Updated main.ts to include global validation pipes
- Implemented `generateNonce` in AuthService utilizing crypto to generate random 32 byte hex and stored it in Redis with a 5-minute TTL via RedisService
- Wrote full unit tests for AuthController and AuthService. Tests pass with 100% success.

### File List
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/main.ts`
- `backend/src/app.module.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.controller.spec.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/dto/nonce-request.dto.ts`

### Change Log
- Implemented wallet nonce generation and caching (Date: 2026-02-22)
