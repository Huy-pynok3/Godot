import { Injectable, NotFoundException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { StartSessionResponseDto } from './dto/start-session-response.dto';
import { StopSessionResponseDto } from './dto/stop-session-response.dto';
import { Prisma } from '@prisma/client';

// Configuration constants
const GRID_WIDTH = 20;
const GRID_HEIGHT = 15;
const CHEST_COUNT = 40;
const CHEST_MIN_HP = 1;
const CHEST_MAX_HP = 3;
const SESSION_CACHE_TTL = 86400; // 24 hours in seconds

@Injectable()
export class TreasureService {
  private readonly logger = new Logger(TreasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async startSession(userId: string): Promise<StartSessionResponseDto> {
    // 1. Check for existing active session
    const existingSession = await this.prisma.treasureSession.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (existingSession) {
      // Return 409 Conflict with existing session data
      const cachedGrid = await this.redis.get(`session:${userId}:grid`);
      if (cachedGrid) {
        const gridData = JSON.parse(cachedGrid);
        this.logger.warn(`Duplicate session attempt for user ${userId}`);
        throw new ConflictException({
          message: 'Active session already exists',
          sessionId: existingSession.id,
          status: 'ACTIVE',
          gridData,
          gridSize: { width: GRID_WIDTH, height: GRID_HEIGHT },
          chestCount: gridData.length,
        });
      }
    }

    // 2. Generate new chest grid
    const gridData = this.generateChestGrid(GRID_WIDTH, GRID_HEIGHT, CHEST_COUNT);

    // 3. Create session in Postgres
    try {
      const session = await this.prisma.treasureSession.create({
        data: {
          userId,
          status: 'ACTIVE',
          chestState: gridData, // Store as JSON
        },
      });

      // 4. Cache grid in Redis
      try {
        await this.redis.set(
          `session:${userId}:grid`,
          JSON.stringify(gridData),
          SESSION_CACHE_TTL,
        );
      } catch (error) {
        this.logger.error(`Redis cache failed: ${error.message}`, error.stack);
        // Continue anyway - Postgres is source of truth
      }

      this.logger.log(`Session ${session.id} started for user ${userId}`);

      return {
        sessionId: session.id,
        status: 'ACTIVE',
        gridData,
        gridSize: { width: GRID_WIDTH, height: GRID_HEIGHT },
        chestCount: gridData.length,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error: ${error.code} - ${error.message}`);
        throw new BadRequestException('Failed to create session due to database constraint');
      }
      throw error;
    }
  }

  async stopSession(userId: string): Promise<StopSessionResponseDto> {
    // 1. Find active session
    const session = await this.prisma.treasureSession.findFirst({
      where: { userId, status: 'ACTIVE' },
    });

    if (!session) {
      throw new NotFoundException('No active session found');
    }

    // 2. Update session status
    try {
      const updatedSession = await this.prisma.treasureSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED' },
      });

      // 3. Clear Redis cache
      try {
        await this.redis.del(`session:${userId}:grid`);
      } catch (error) {
        this.logger.error(`Redis delete failed: ${error.message}`, error.stack);
        // Continue anyway - session is stopped in Postgres
      }

      this.logger.log(`Session ${session.id} stopped for user ${userId}`);

      return {
        sessionId: updatedSession.id,
        status: 'COMPLETED',
        message: 'Session stopped successfully',
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`Prisma error: ${error.code} - ${error.message}`);
        throw new BadRequestException('Failed to stop session due to database error');
      }
      throw error;
    }
  }

  private generateChestGrid(
    gridWidth: number,
    gridHeight: number,
    chestCount: number,
  ): Array<{ x: number; y: number; hp: number }> {
    const chests = [];
    const occupiedCells = new Set<string>();

    // Validate chest count doesn't exceed grid capacity
    const maxChests = gridWidth * gridHeight;
    if (chestCount > maxChests) {
      this.logger.warn(
        `Chest count ${chestCount} exceeds grid capacity ${maxChests}, capping to ${maxChests}`,
      );
      chestCount = maxChests;
    }

    while (chests.length < chestCount) {
      const x = Math.floor(Math.random() * gridWidth);
      const y = Math.floor(Math.random() * gridHeight);
      const key = `${x},${y}`;

      if (!occupiedCells.has(key)) {
        occupiedCells.add(key);
        const hp = Math.floor(Math.random() * (CHEST_MAX_HP - CHEST_MIN_HP + 1)) + CHEST_MIN_HP;
        chests.push({ x, y, hp });
      }
    }

    return chests;
  }
}
