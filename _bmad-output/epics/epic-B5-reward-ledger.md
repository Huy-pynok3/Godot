---
epic: B5
title: "Reward Ledger & Claim Quote"
status: "backlog"
priority: "high"
depends_on: ["B4"]
---

# Epic B5: Reward Ledger & Claim Quote

## Objective
Implement an append-only ledger for all BCOIN balance changes, generate aggregated pending balances, and provide cryptographically secure EIP-712 claim vouchers for the Godot client.

## Definition of Done (DoD)
- [ ] Chest destructions write positive amounts to the `RewardLedger`.
- [ ] Server calculates and returns a user's `PendingBalance`.
- [ ] Client can request a `ClaimQuote` (EIP-712 voucher) for withdrawal.
- [ ] Vouchers are signed securely by the backend's private key.
- [ ] Concurrent claim requests are locked to prevent double-spending the quote.

## User Stories

### ST-B5.1 — Implement RewardLedger
**As a** player,
**I want** my chest destructions to securely accumulate BCOIN off-chain,
**So that** I don't pay gas fees until I withdraw.

**Acceptance Criteria:**
- Create `RewardLedger` model with `userId`, `amount`, `source` (e.g., 'CHEST_DESTROY', 'CLAIM_WITHDRAWAL'), and `referenceId` (e.g., chest or claim ID).
- When a `chest_destroyed` event occurs (ST-B4.3), determine a randomized BCOIN reward (e.g., `Math.random() * 0.5 + 0.1`).
- Wrap the stamina drain (ST-B4.4) and the `RewardLedger` insert in a single Postgres transaction.
- Emit `reward_received` via WebSocket to notify the client of the specific drop.

### ST-B5.2 — Implement PendingBalance Aggregation
**As a** client,
**I want** to query my total accumulated balance,
**So that** I know how much I can claim.

**Acceptance Criteria:**
- Create a `BalanceService.getPendingBalance(userId)` method.
- Sum all `amount` entries in `RewardLedger` for the user.
- Add an endpoint `GET /users/me/balance` (requires JWT) returning `{ balance: 10.5 }`.
- Cache the aggregated balance in Redis `user:{userId}:balance` for performance, invalidating it upon new ledger entries.

### ST-B5.3 — Generate EIP-712 Claim Quote
**As a** player,
**I want** to request a secure voucher for my pending balance,
**So that** I can submit it to the smart contract via MetaMask.

**Acceptance Criteria:**
- Create `POST /claim/quote` endpoint (requires JWT).
- Accepts `{ "amount": "10.0" }`.
- Acquire Redis lock `lock:claim:{userId}` to prevent concurrent requests.
- Verify `amount` <= `PendingBalance`.
- Generate a unique `claimId` (UUID or incremental nonce).
- Insert a `Claim` record with status `QUOTED`.
- Use `ethers.js` and the server's `SIGNER_PRIVATE_KEY` to sign an EIP-712 payload matching the contract's expected struct (e.g., `{ user: address, amount: uint256, claimId: string, deadline: uint256, nonce: uint256 }`).
- Return the `claimId` and the generated `voucher` object.
- Release the lock.