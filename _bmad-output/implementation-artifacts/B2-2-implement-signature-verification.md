# Story B2.2: Implement Signature Verification

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a client,
I want to submit my signed nonce,
so that the server verifies my wallet ownership and issues a session token.

## Acceptance Criteria

1. Create `POST /auth/wallet-login` endpoint.
2. Accepts `{ "walletAddress": "0x...", "signature": "0x..." }`.
3. Retrieves the cached nonce from Redis (and deletes it to prevent reuse).
4. Uses `ethers.js` (`verifyMessage`) to recover the address from the signature.
5. Verifies the recovered address matches the provided `walletAddress` (case-insensitive).
6. Creates a `User` record if one does not exist.
7. Issues a JWT containing the user's `id` and `walletAddress`.
8. Returns `{ "accessToken": "jwt_string" }`.

## Tasks / Subtasks

- [x] Task 1: Setup DTO and Endpoint (AC: #1, #2)
  - [x] Create `WalletLoginDto` with `walletAddress` and `signature` (both strings, required). Use class-validator.
  - [x] Add `POST /auth/wallet-login` endpoint to `AuthController` accepting `WalletLoginDto`.
- [x] Task 2: Verify Nonce and Signature (AC: #3, #4, #5)
  - [x] Add `ethers` dependency to backend.
  - [x] Implement `verifySignature` logic in `AuthService`.
  - [x] Fetch the nonce from Redis using `user:{walletAddress.toLowerCase()}:nonce`.
  - [x] If nonce doesn't exist, throw `UnauthorizedException` ('Invalid or expired nonce').
  - [x] Delete the nonce from Redis immediately after reading to prevent replay attacks.
  - [x] Use `ethers.verifyMessage(nonce, signature)` to recover the signer's address.
  - [x] Compare recovered address to the provided `walletAddress` (case-insensitive). Throw `UnauthorizedException` if they mismatch.
- [x] Task 3: Manage User Record (AC: #6)
  - [x] Inject `PrismaService` into `AuthService` (needs `PrismaModule` imported into `AuthModule` if not already).
  - [x] Check if a `User` exists with the `walletAddress` (always lowercase/normalize when querying database to avoid dupes).
  - [x] If not, create a new `User` record.
- [x] Task 4: Issue JWT (AC: #7, #8)
  - [x] Install `@nestjs/jwt`.
  - [x] Import and configure `JwtModule.register()` in `AuthModule` using a secret from environment variables (`JWT_SECRET`).
  - [x] In `AuthService`, generate a JWT containing `{ sub: user.id, walletAddress: user.walletAddress }`.
  - [x] Return `{ accessToken: jwt }` from the controller.
- [x] Task 5: Tests
  - [x] Write unit tests for `verifySignature` checking success paths, missing nonces, and invalid signatures.

## Dev Notes

### Architecture Patterns
- **Authentication:** Standard EIP-191 message signing. The nonce generated in B2.1 must be the exact string signed by the client.
- **Idempotency/Security:** The nonce must be deleted *immediately* after retrieval from Redis, regardless of whether signature verification succeeds or fails. This is a critical security requirement to prevent replay attacks.
- **Address Normalization:** Always normalize (lowercase) Ethereum addresses before database lookups/inserts and Redis key generation.

### Source Tree
- `backend/src/auth/auth.controller.ts` (Update)
- `backend/src/auth/auth.service.ts` (Update)
- `backend/src/auth/auth.module.ts` (Update)
- `backend/src/auth/dto/wallet-login.dto.ts` (New)

### Dependencies
- Story B2.1 must be complete.
- `ethers` must be installed.
- `@nestjs/jwt` must be installed.
- `PrismaService` must be available.

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.

## References

- [Source: _bmad-output/epics/epic-B2-auth.md#ST-B2.2]

## Dev Agent Record

### Agent Model Used

gemini-3.1-pro-high

### Debug Log References

- Installed `ethers`, `@nestjs/jwt`, and `@nestjs/config` via `npm install`
- Updated `WalletLoginDto` to validate both `walletAddress` and `signature` format using regex.
- Added `walletLogin` endpoint in `AuthController`
- Implemented `verifySignatureAndLogin` in `AuthService` handling logic for validating the signed message, getting/deleting the nonce from Redis, upserting the user in the database with Prisma, and returning a signed JWT token.
- Updated `AuthModule` to include `PrismaModule`, `JwtModule.registerAsync`, and config setup.
- Created robust unit tests for `AuthService` checking verification and failure cases.
- All tests passing.

### Completion Notes List

- All tasks completed. `verifySignatureAndLogin` properly manages the immediate deletion of nonces regardless of success/fail, and normalizes Ethereum addresses for lookups.

### File List

- `backend/package.json`
- `backend/src/auth/auth.controller.spec.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.spec.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/dto/wallet-login.dto.ts`