# Story B1.2: Define Prisma Schema

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want to define the core data models using Prisma,
so that we have a strongly typed, version-controlled database schema.

## Acceptance Criteria

1. `schema.prisma` includes: `User`, `Hero`, `TreasureSession`, `RewardLedger`, and `Claim` models.
2. Proper relations (1:N, foreign keys) are defined.
3. Required indices and unique constraints (e.g., `walletAddress`) are implemented.
4. First migration (`init`) is generated and applied to the local Postgres container.

## Tasks / Subtasks

- [ ] Task 1: Setup Prisma in NestJS (AC: #1)
  - [ ] Run `npx prisma init` in `backend/`
  - [ ] Install `@prisma/client` and generate Prisma service
- [ ] Task 2: Define Data Models (AC: #1, #2, #3)
  - [ ] Define `User` model with `walletAddress` (unique) and `nonce`
  - [ ] Define `Hero` model linked to `User` containing stats and stamina state
  - [ ] Define `TreasureSession` model linked to `User` with session status
  - [ ] Define `RewardLedger` append-only model linked to `User`
  - [ ] Define `Claim` model linked to `User` for tracking on-chain payouts
- [ ] Task 3: Create & Apply Migration (AC: #4)
  - [ ] Start Postgres via Docker (`docker-compose up -d postgres`)
  - [ ] Run `npx prisma migrate dev --name init`
  - [ ] Verify `schema.prisma` formats and generates the client successfully

## Dev Notes

### Architecture Patterns
- **Database:** PostgreSQL.
- **Append-only Ledger:** `RewardLedger` must NOT update balances. It only inserts records (positive for earnings, negative for claims). The user balance is calculated via sum aggregation.
- **Idempotency Constraints:** Ensure `walletAddress` is unique on `User`. The `Claim` model should have a unique constraint on `txHash`.

### Source Tree
- `backend/prisma/schema.prisma` (New)
- `backend/src/prisma/prisma.service.ts` (New module wrapper)

### Dependencies
- Story ST-B1.1 must be completed (NestJS and Postgres docker setup).

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.

## References

- [Source: _bmad-output/epics/epic-B1-backend-setup.md#ST-B1.2]
- [Source: _bmad-output/game-architecture.md (implicitly via Epic structure)]

## Dev Agent Record

### Agent Model Used

gemini-3.1-pro-high

### Debug Log References

### Completion Notes List

### File List
- `backend/prisma/schema.prisma` (created)
- `backend/src/prisma/prisma.service.ts` (created)
- `backend/src/prisma/prisma.module.ts` (created)