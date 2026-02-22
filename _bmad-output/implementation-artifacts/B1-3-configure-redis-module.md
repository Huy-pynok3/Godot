# Story B1.3: Configure Redis Module

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a backend developer,
I want to integrate Redis into the NestJS application,
so that we can support fast caching and distributed locks for game logic.

## Acceptance Criteria

1. `ioredis` (or `@nestjs-modules/ioredis`) is installed and configured.
2. A basic Redis service is created to handle `get`, `set`, and `setnx` (lock) operations.
3. Application successfully connects to the Redis container on startup.

## Tasks / Subtasks

- [x] Task 1: Install and configure Redis dependencies (AC: #1)
  - [x] Install `@nestjs-modules/ioredis` and `ioredis` in `backend/`
  - [x] Add Redis connection URL to `.env.example` and update `docker-compose.dev.yml` to expose Redis port if necessary (usually 6379).
- [x] Task 2: Implement Redis Service Module (AC: #1, #2)
  - [x] Create a globally accessible `RedisModule` in NestJS
  - [x] Implement a `RedisService` wrapping `ioredis` with typed methods:
    - `get(key: string): Promise<string | null>`
    - `set(key: string, value: string, ttlSeconds?: number): Promise<void>`
    - `setnx(key: string, value: string, ttlSeconds: number): Promise<boolean>` (crucial for idempotency/locking)
- [x] Task 3: Verify Connection on Startup (AC: #3)
  - [x] Add lifecycle hook (`onApplicationBootstrap` or similar) to verify Redis connection (e.g., ping)
  - [x] Log connection success or failure via NestJS Logger.
  - [x] Ensure `docker-compose up` cleanly starts PostgreSQL, Redis, and the NestJS app without connection errors.

## Dev Notes

### Architecture Patterns
- **Database / Caching Layer:** Redis is the core caching and distributed locking mechanism. The `setnx` operation is explicitly called out because the server-authoritative backend will require strict idempotency (e.g., preventing duplicate bomb placements or simultaneous claims).
- **Configuration:** Redis URL should be injected via NestJS `ConfigModule`. Do not hardcode the connection string (`redis://localhost:6379` locally, `redis://redis:6379` in docker).

### Source Tree
- `backend/src/redis/redis.module.ts` (New)
- `backend/src/redis/redis.service.ts` (New)
- `backend/app.module.ts` (Update to import `RedisModule`)

### Dependencies
- Story ST-B1.1 must be completed (NestJS and Docker setup, Redis container should already be defined in `docker-compose.dev.yml`).

## Project Structure Notes

- **Path:** Execute all commands inside the `backend/` directory.

## References

- [Source: _bmad-output/epics/epic-B1-backend-setup.md#ST-B1.3]
- [Source: _bmad-output/game-architecture.md]

## Dev Agent Record

### Agent Model Used

gemini-3.1-pro-high

### Debug Log References

### Completion Notes List
- Task 1: Installed `@nestjs-modules/ioredis`, `ioredis`, and `@types/ioredis`. Checked `.env.example` and `docker-compose.dev.yml` - they already contained the correct `REDIS_URL` and `6379:6379` port exposure respectively.
- Task 2: Generated `RedisModule` and `RedisService`. Configured `RedisModule` with `NestJsRedisModule.forRoot` using environment variables. Implemented `get`, `set`, and `setnx` methods in `RedisService`.
- Task 3: Implemented `OnApplicationBootstrap` in `RedisService` to automatically ping Redis and log the connection status. Tests were written to ensure full coverage of this functionality and all pass. The application successfully started up and connected to Redis as seen in the logs.

### File List
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/app.module.ts`
- `backend/src/redis/redis.module.ts`
- `backend/src/redis/redis.service.ts`
- `backend/src/redis/redis.service.spec.ts`

### Change Log
- Implemented Redis Module for application cache and distributed locks - All tasks completed successfully (Date: 2026-02-22)
