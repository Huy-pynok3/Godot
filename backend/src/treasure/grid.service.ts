import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

interface ChestData {
  x: number;
  y: number;
  hp: number;
}

interface Position {
  x: number;
  y: number;
}

export enum MoveRejectionReason {
  LOCKED = 'LOCKED',
  NO_SESSION = 'NO_SESSION',
  NO_POSITION = 'NO_POSITION',
  INVALID_PATH = 'INVALID_PATH',
  OUT_OF_BOUNDS = 'OUT_OF_BOUNDS',
  OBSTACLE = 'OBSTACLE',
  SERVER_ERROR = 'SERVER_ERROR',
}

@Injectable()
export class GridService {
  private readonly logger = new Logger(GridService.name);
  private readonly GRID_WIDTH = 20;
  private readonly GRID_HEIGHT = 15;

  constructor(private readonly redis: RedisService) {}

  /**
   * Load grid from Redis
   */
  async loadGrid(userId: number): Promise<ChestData[] | null> {
    try {
      const gridJson = await this.redis.get(`session:${userId}:grid`);
      if (!gridJson) {
        return null;
      }
      return JSON.parse(gridJson) as ChestData[];
    } catch (error) {
      this.logger.error(`Failed to load grid for user ${userId}`, error.stack);
      return null;
    }
  }

  /**
   * Get hero's last known position
   */
  async getHeroPosition(
    userId: number,
    tokenId: number,
  ): Promise<Position | null> {
    try {
      const posJson = await this.redis.get(
        `hero:${userId}:${tokenId}:position`,
      );
      if (!posJson) {
        return null;
      }
      return JSON.parse(posJson) as Position;
    } catch (error) {
      this.logger.error(`Failed to get hero position`, error.stack);
      return null;
    }
  }

  /**
   * Update hero's position in Redis
   */
  async updateHeroPosition(
    userId: number,
    tokenId: number,
    position: Position,
  ): Promise<void> {
    try {
      await this.redis.set(
        `hero:${userId}:${tokenId}:position`,
        JSON.stringify(position),
        'EX',
        86400, // 24 hours TTL
      );
    } catch (error) {
      this.logger.error(`Failed to update hero position`, error.stack);
      throw error;
    }
  }

  /**
   * Validate if a move is legal
   */
  async validateMove(
    userId: number,
    tokenId: number,
    targetX: number,
    targetY: number,
  ): Promise<{ valid: boolean; reason?: MoveRejectionReason }> {
    // Load grid
    const grid = await this.loadGrid(userId);
    if (!grid) {
      return { valid: false, reason: MoveRejectionReason.NO_SESSION };
    }

    // Get current position
    const currentPos = await this.getHeroPosition(userId, tokenId);
    if (!currentPos) {
      return { valid: false, reason: MoveRejectionReason.NO_POSITION };
    }

    // Check bounds
    if (!this.isInBounds(targetX, targetY)) {
      return { valid: false, reason: MoveRejectionReason.OUT_OF_BOUNDS };
    }

    // Check adjacency (Manhattan distance = 1)
    const distance = this.manhattanDistance(currentPos, {
      x: targetX,
      y: targetY,
    });
    if (distance !== 1) {
      return { valid: false, reason: MoveRejectionReason.INVALID_PATH };
    }

    // Check obstacle
    if (this.isObstacle(targetX, targetY, grid)) {
      return { valid: false, reason: MoveRejectionReason.OBSTACLE };
    }

    return { valid: true };
  }

  private isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.GRID_WIDTH && y >= 0 && y < this.GRID_HEIGHT;
  }

  private manhattanDistance(a: Position, b: Position): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  private isObstacle(x: number, y: number, grid: ChestData[]): boolean {
    return grid.some((chest) => chest.x === x && chest.y === y && chest.hp > 0);
  }
}
