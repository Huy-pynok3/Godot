---
epic: B2
title: "Auth & Wallet Login"
status: "backlog"
priority: "high"
depends_on: ["B1"]
---

# Epic B2: Auth & Wallet Login

## Objective
Implement secure, Web3-native authentication using MetaMask wallet signatures to issue JWTs for the Godot client.

## Definition of Done (DoD)
- [ ] User can request a unique nonce via `POST /auth/nonce`.
- [ ] Server validates the EIP-191/4361 signature in `POST /auth/wallet-login`.
- [ ] Valid signature generates and returns a JWT.
- [ ] JWT validates correctly via an Auth Guard for protected endpoints.
- [ ] Invalid signatures or expired nonces are rejected.

## User Stories

### ST-B2.1 — Implement Nonce Generation
**As a** client,
**I want** to request a cryptographic nonce linked to my wallet address,
**So that** I can sign it to prove ownership.

**Acceptance Criteria:**
- Create `POST /auth/nonce` endpoint.
- Accepts `{ "walletAddress": "0x..." }`.
- Generates a random alphanumeric nonce (e.g., using `crypto.randomBytes`).
- Caches the nonce in Redis as `user:{wallet}:nonce` with a 5-minute expiration (TTL).
- Returns `{ "nonce": "the_nonce_string" }`.

### ST-B2.2 — Implement Signature Verification
**As a** client,
**I want** to submit my signed nonce,
**So that** the server verifies my wallet ownership and issues a session token.

**Acceptance Criteria:**
- Create `POST /auth/wallet-login` endpoint.
- Accepts `{ "walletAddress": "0x...", "signature": "0x..." }`.
- Retrieves the cached nonce from Redis (and deletes it to prevent reuse).
- Uses `ethers.js` (`verifyMessage`) to recover the address from the signature.
- Verifies the recovered address matches the provided `walletAddress` (case-insensitive).
- Creates a `User` record if one does not exist.
- Issues a JWT containing the user's `id` and `walletAddress`.
- Returns `{ "accessToken": "jwt_string" }`.

### ST-B2.3 — Create Auth Guard
**As a** backend developer,
**I want** a reusable JWT authorization guard,
**So that** I can easily secure REST and WebSocket endpoints.

**Acceptance Criteria:**
- Create a NestJS `@Injectable() class JwtAuthGuard`.
- Validates the `Authorization: Bearer <token>` header against the `JWT_SECRET`.
- Injects the decoded user payload into the request object (`req.user`).
- Rejects requests lacking a token or with an invalid/expired token with `401 Unauthorized`.
