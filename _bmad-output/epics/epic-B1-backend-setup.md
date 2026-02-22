---
epic: B1
title: "Backend Setup + Prisma + Docker"
status: "done"
priority: "critical"
depends_on: []
---

# Epic B1: Backend Setup + Prisma + Docker

## Objective
Establish the foundational NestJS backend infrastructure, including the database (PostgreSQL via Prisma), caching/locking layer (Redis), and containerization (Docker Compose) for local development.

## Definition of Done (DoD)
- [x] NestJS application starts successfully in a Docker container.
- [x] PostgreSQL and Redis containers are running and accessible.
- [x] Prisma schema is defined and initial migration is applied.
- [x] Database and Redis connections are established and verified on startup.
- [x] Basic health check endpoint (`/health`) returns 200 OK.

## User Stories

### ST-B1.1 — Scaffold NestJS & Docker
**As a** backend developer,
**I want** to initialize the NestJS project and Docker Compose environment,
**So that** all services (API, DB, Cache) can be spun up with a single command.

**Acceptance Criteria:**
- `backend/` directory created with a fresh NestJS installation.
- `docker-compose.dev.yml` created with `backend`, `postgres`, and `redis` services.
- `.env.example` provided with default local connection strings.
- Running `docker-compose up` starts all services without errors.

### ST-B1.2 — Define Prisma Schema
**As a** backend developer,
**I want** to define the core data models using Prisma,
**So that** we have a strongly typed, version-controlled database schema.

**Acceptance Criteria:**
- `schema.prisma` includes: `User`, `Hero`, `TreasureSession`, `RewardLedger`, and `Claim` models.
- Proper relations (1:N, foreign keys) are defined.
- Required indices and unique constraints (e.g., `walletAddress`) are implemented.
- First migration (`init`) is generated and applied to the local Postgres container.

### ST-B1.3 — Configure Redis Module
**As a** backend developer,
**I want** to integrate Redis into the NestJS application,
**So that** we can support fast caching and distributed locks for game logic.

**Acceptance Criteria:**
- `ioredis` (or `@nestjs-modules/ioredis`) is installed and configured.
- A basic Redis service is created to handle `get`, `set`, and `setnx` (lock) operations.
- Application successfully connects to the Redis container on startup.
