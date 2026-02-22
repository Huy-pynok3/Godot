---
epic: B4
title: "Treasure Session & Authoritative Logic"
status: "backlog"
priority: "critical"
depends_on: ["B1", "B3"]
---

# Epic B4: Treasure Session & Authoritative Logic

## Objective
Implement the server-side authoritative engine for the Treasure Hunt phase. Validate movement, bombs, and stamina locally before broadcasting outcomes to the client.

## Definition of Done (DoD)
- [ ] User can start a `TreasureSession`, generating a server-side chest map.
- [ ] Server validates `move_intent` against grid boundaries and obstacles.
- [ ] Server calculates bomb explosion radii and triggers `chest_destroyed`.
- [ ] Stamina is tracked authoritatively per hero; actions failing stamina checks are rejected.
- [ ] Redis distributed locks prevent concurrent hero actions.

## User Stories

### ST-B4.1 — Implement Session Start/Stop
**As a** client,
**I want** to begin a Treasure Hunt session,
**So that** the server prepares the grid and allows my heroes to act.

**Acceptance Criteria:**
- `POST /treasure/start` endpoint (requires JWT) creates a `TreasureSession` (Status: ACTIVE).
- Generates a randomized grid of chests (using `Constants.GRID_SIZE`) and stores it in Redis `session:{userId}:grid` (and optionally `TreasureSession.chestState` in Postgres).
- Returns the initial `gridData` (chest positions and HP) to the client.
- `POST /treasure/stop` endpoint marks the session COMPLETED and clears the Redis grid cache.

### ST-B4.2 — Implement A* Movement Validation
**As a** server,
**I want** to validate every `move_intent` against my internal grid,
**So that** clients cannot teleport or walk through chests/walls.

**Acceptance Criteria:**
- Create a `GridService` that loads the user's current grid from Redis.
- When `move_intent` is received, acquire a Redis lock `lock:hero_action:{tokenId}` (TTL: 500ms).
- Validate the path from the hero's last known position to `(x, y)` using basic adjacency or A* (if distance > 1 cell).
- Ensure the destination `(x, y)` is empty (no chest, no wall).
- If valid: Update hero's position in memory/Redis, emit `hero_move_confirmed`.
- If invalid: Emit `hero_move_rejected` with reason `OBSTACLE` or `INVALID_PATH`.
- Release the lock.

### ST-B4.3 — Implement Bomb Validation & Explosion
**As a** server,
**I want** to authoritatively calculate bomb explosions,
**So that** clients cannot artificially destroy chests.

**Acceptance Criteria:**
- When `bomb_intent` is received, acquire lock `lock:hero_action:{tokenId}`.
- Verify the hero is at `(x, y)` and has sufficient stamina (e.g., > 1.0).
- If valid: Drain stamina (see ST-B4.4), emit `bomb_validated`.
- Calculate affected cells based on the hero's `bombRange` stat (cross pattern).
- For each affected cell containing a chest:
  - Decrement chest HP in Redis `session:{userId}:grid`.
  - If HP <= 0, remove the chest and emit `chest_destroyed`.
- Release the lock.

### ST-B4.4 — Implement Authoritative Stamina Drain
**As a** server,
**I want** to track and drain hero stamina securely,
**So that** clients cannot manipulate their energy levels.

**Acceptance Criteria:**
- Create a `HeroService` to manage stamina.
- On `bomb_intent` success, drain `Balance.STAMINA_DRAIN_PER_TICK` from the hero's `staminaCurrent` in Postgres (inside a transaction if combined with rewards).
- Emit `stamina_updated` with the new value.
- Reject actions if `staminaCurrent` is below the required threshold.
- Implement lazy stamina regeneration: when a hero's stats are loaded, calculate `(now - lastRestTime) * regenRate` and update `staminaCurrent` before processing intents.