---
epic: B6
title: "Tx Verification Worker (BullMQ)"
status: "backlog"
priority: "high"
depends_on: ["B5"]
---

# Epic B6: Tx Verification Worker (BullMQ)

## Objective
Establish an asynchronous, robust background worker to verify on-chain transactions submitted by clients, ensuring the authoritative ledger is updated only when the blockchain finalizes a claim.

## Definition of Done (DoD)
- [ ] User can submit a `txHash` to `POST /claim/submit`.
- [ ] BullMQ job is successfully queued and processed in the background.
- [ ] Worker verifies the transaction receipt and decodes expected event logs.
- [ ] The `Claim` status and `RewardLedger` are correctly updated based on the on-chain outcome.
- [ ] Idempotency prevents double-crediting.

## User Stories

### ST-B6.1 — Setup BullMQ & Redis
**As a** backend developer,
**I want** to integrate BullMQ for asynchronous job processing,
**So that** I don't block the main API thread waiting for blockchain confirmations.

**Acceptance Criteria:**
- Install `@nestjs/bullmq` and `bullmq`.
- Configure the `ClaimQueue` backed by the existing Redis connection.
- Ensure the worker process starts successfully and can process test jobs.
- Setup basic job retry logic (e.g., exponential backoff) for transient RPC failures.

### ST-B6.2 — Accept Claim Submissions
**As a** client,
**I want** to report my MetaMask transaction hash,
**So that** the server can verify my withdrawal.

**Acceptance Criteria:**
- Create `POST /claim/submit` endpoint (requires JWT).
- Accepts `{ "claimId": "uuid", "txHash": "0x..." }`.
- Verify the `Claim` exists, belongs to the user, and is in `QUOTED` status.
- Prevent duplicate submissions for the same `txHash` (unique index in Postgres).
- Update the `Claim` status to `SUBMITTED` and save the `txHash`.
- Add a job to the `ClaimQueue` with the `claimId` and `txHash`.
- Return `{ "status": "SUBMITTED" }`.

### ST-B6.3 — Verify Transaction & Decode Logs
**As a** worker,
**I want** to query the BSC node for the transaction receipt,
**So that** I can definitively confirm the claim succeeded on-chain.

**Acceptance Criteria:**
- Create `VerifyClaimTxProcessor` class implementing `WorkerHost` or `@Processor()`.
- Use `ethers.js` or `viem` to fetch the transaction receipt for the `txHash`.
- If the receipt is null (pending), throw an error to trigger a BullMQ retry.
- If the receipt `status` is `0` (reverted), mark the `Claim` as `FAILED` (no ledger change).
- If the receipt `status` is `1` (success), decode the logs.
- Verify the contract emitted a `Claimed` event matching the `claimId`, `userId`, and `amount`.

### ST-B6.4 — Finalize Ledger & Unlock Balance
**As a** worker,
**I want** to securely update the append-only ledger,
**So that** the user's pending balance accurately reflects the withdrawal.

**Acceptance Criteria:**
- Open a Postgres transaction.
- If the transaction verification (ST-B6.3) was successful:
  - Update `Claim` status to `VERIFIED`.
  - Insert a new `RewardLedger` entry with a *negative* amount (e.g., `-10.0`), source `CLAIM_WITHDRAWAL`, and referenceId `claimId`.
- Commit the transaction.
- Update the user's cached `PendingBalance` in Redis.
- If the verification failed (e.g., mismatched logs, reverted), update `Claim` status to `FAILED`. (The user's pending balance remains intact, and they can request a new quote later).
- Implement endpoint `GET /claim/:id/status` (requires JWT) returning `{ "status": "VERIFIED" | "FAILED" | "SUBMITTED" }` for the client to poll.