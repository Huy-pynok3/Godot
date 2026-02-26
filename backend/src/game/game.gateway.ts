import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { MoveIntentDto } from './dto/move-intent.dto';
import { BombIntentDto } from './dto/bomb-intent.dto';
import { GridService, MoveRejectionReason } from '../treasure/grid.service';
import { RedisLockService } from '../common/redis-lock.service';
import { HeroService } from '../treasure/hero.service';

@UsePipes(
  new ValidationPipe({
    transform: true,
    exceptionFactory: (errors) => new WsException(errors),
  }),
)
@WebSocketGateway({ namespace: 'game' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly gridService: GridService,
    private readonly lockService: RedisLockService,
    private readonly heroService: HeroService,
  ) {}

  async handleConnection(client: Socket) {
    this.logger.log(`Client attempting to connect: ${client.id}`);

    const token = this.extractTokenFromHandshake(client);

    if (!token) {
      this.logger.warn(`Disconnecting client ${client.id}: No token provided`);
      client.disconnect();
      return;
    }

    try {
      // 1. Authenticate & Join Session Room
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'super-secret-default-key-for-dev'),
      });
      client.data.user = payload;

      const userId = payload.id;
      const walletAddress = payload.walletAddress;

      // Join a room specifically for this user's session
      client.join(`session:${userId}`);

      // Store connection mapping in Redis: walletAddress -> socketId
      await this.redisService.set(`connection:${walletAddress}`, client.id);

      this.logger.log(`Client connected successfully: ${client.id} (Wallet: ${walletAddress}, Session: ${userId})`);
    } catch (error) {
      this.logger.warn(`Disconnecting client ${client.id}: Invalid token`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove mapping from Redis if user was authenticated
    if (client.data && client.data.user) {
      const walletAddress = client.data.user.walletAddress;
      const currentSocketId = await this.redisService.get(`connection:${walletAddress}`);

      // Only delete if the socket ID matches (handles multiple connection/reconnection edge cases)
      if (currentSocketId === client.id) {
        await this.redisService.del(`connection:${walletAddress}`);
        this.logger.log(`Removed connection mapping for wallet: ${walletAddress}`);
      }
    }
  }

  private extractTokenFromHandshake(client: Socket): string | undefined {
    // Check if token is in auth payload (socket.io standard)
    if (client.handshake?.auth?.token) {
      return client.handshake.auth.token;
    }
    // Check query params as fallback
    const queryToken = client.handshake?.query?.token;
    if (queryToken) {
      return Array.isArray(queryToken) ? queryToken[0] : queryToken;
    }
    // Check headers as last resort
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
       return authHeader.split(' ')[1];
    }
    return undefined;
  }

  @SubscribeMessage('move_intent')
  async handleMoveIntent(
    @MessageBody() moveIntentDto: MoveIntentDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const tokenId = moveIntentDto.hero_id; // hero_id is the NFT token ID
    const { x, y } = moveIntentDto;
    const userId = client.data.user?.id; // User ID from JWT payload

    if (!userId) {
      this.logger.warn(`Move intent rejected: No user ID in socket data`);
      this.emitMoveRejected(client, tokenId, MoveRejectionReason.SERVER_ERROR);
      return;
    }

    const lockKey = `lock:hero_action:${tokenId}`;

    try {
      // Acquire lock
      const lockAcquired = await this.lockService.acquireLock(lockKey, 500);
      if (!lockAcquired) {
        this.logger.warn(
          `Move intent rejected: Lock acquisition failed for hero ${tokenId}`,
        );
        this.emitMoveRejected(client, tokenId, MoveRejectionReason.LOCKED);
        return;
      }

      try {
        // 0. Verify Stamina first
        const hero = await this.heroService.getHero(tokenId);
        if (!hero || !this.heroService.hasSufficientStamina(hero)) {
          this.logger.log(`Move rejected for hero ${tokenId}: Insufficient stamina`);
          this.emitMoveRejected(client, tokenId, MoveRejectionReason.INSUFFICIENT_STAMINA);
          return;
        }

        // 1. Validate move
        const validation = await this.gridService.validateMove(
          userId,
          tokenId,
          x,
          y,
        );

        if (!validation.valid) {
          this.logger.log(
            `Move rejected for hero ${tokenId}: ${validation.reason}`,
          );
          this.emitMoveRejected(
            client,
            tokenId,
            validation.reason || MoveRejectionReason.SERVER_ERROR,
          );
          return;
        }

        // Update position
        await this.gridService.updateHeroPosition(userId, tokenId, { x, y });

        // Emit confirmation
        this.logger.log(`Move confirmed for hero ${tokenId} to (${x}, ${y})`);
        this.emitMoveConfirmed(client, tokenId, x, y);
      } finally {
        // Always release lock
        await this.lockService.releaseLock(lockKey);
      }
    } catch (error) {
      this.logger.error(
        `Move intent error for hero ${tokenId}: ${error.message}`,
        error.stack,
      );
      this.emitMoveRejected(client, tokenId, MoveRejectionReason.SERVER_ERROR);
    }
  }

  private emitMoveConfirmed(
    client: Socket,
    tokenId: number,
    x: number,
    y: number,
  ): void {
    client.emit('hero_move_confirmed', {
      tokenId,
      position: { x, y },
      timestamp: Date.now(),
    });
  }

  private emitMoveRejected(
    client: Socket,
    tokenId: number,
    reason: MoveRejectionReason,
  ): void {
    client.emit('hero_move_rejected', {
      tokenId,
      reason,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('bomb_intent')
  async handleBombIntent(
    @MessageBody() bombIntentDto: BombIntentDto,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const tokenId = bombIntentDto.hero_id;
    const { x, y } = bombIntentDto;
    const userId = client.data.user?.id;

    if (!userId) {
      this.logger.warn(`Bomb intent rejected: No user ID in socket data`);
      return;
    }

    const lockKey = `lock:hero_action:${tokenId}`;

    try {
      // Acquire lock
      const lockAcquired = await this.lockService.acquireLock(lockKey, 500);
      if (!lockAcquired) {
        this.logger.warn(`Bomb intent rejected: Lock acquisition failed for hero ${tokenId}`);
        return;
      }

      try {
        // 1. Verify position
        const currentPos = await this.gridService.getHeroPosition(userId, tokenId);
        if (!currentPos || currentPos.x !== x || currentPos.y !== y) {
          this.logger.warn(`Bomb intent rejected: Position mismatch for hero ${tokenId}`);
          return;
        }

        // 2. Get Hero data & Check Stamina
        const hero = await this.heroService.getHero(tokenId);
        if (!hero || !this.heroService.hasSufficientStamina(hero)) {
          this.logger.warn(`Bomb intent rejected: Insufficient stamina for hero ${tokenId}`);
          client.emit('hero_bomb_rejected', {
            hero_id: tokenId,
            reason: MoveRejectionReason.INSUFFICIENT_STAMINA,
          });
          return;
        }

        // 3. Drain Stamina
        const updatedHero = await this.heroService.drainStamina(tokenId);

        // 3.1 Emit stamina update to session
        this.server.to(`session:${userId}`).emit('stamina_updated', {
          hero_id: tokenId,
          stamina: updatedHero.staminaCurrent,
        });

        // 4. Emit confirmation
        client.emit('bomb_validated', { hero_id: tokenId, x, y });

        // 5. Calculate Explosion & Hit Chests
        const MAX_BOMB_RANGE = 5; // Safety cap
        const range = Math.min(hero.bombRange || 1, MAX_BOMB_RANGE);

        const affectedCells = this.calculateCrossPattern(x, y, range);
        for (const cell of affectedCells) {
          const hitResult = await this.gridService.hitChest(userId, cell.x, cell.y);
          if (hitResult.hit) {
            this.server.to(`session:${userId}`).emit('chest_hit', {
              x: cell.x,
              y: cell.y,
              hero_id: tokenId,
              destroyed: hitResult.destroyed,
            });

            if (hitResult.destroyed) {
              this.server.to(`session:${userId}`).emit('chest_destroyed', {
                x: cell.x,
                y: cell.y,
                hero_id: tokenId,
              });
            }
          }
        }
      } finally {
        await this.lockService.releaseLock(lockKey);
      }
    } catch (error) {
      this.logger.error(`Bomb intent error for hero ${tokenId}: ${error.message}`, error.stack);
    }
  }

  private calculateCrossPattern(x: number, y: number, range: number): { x: number; y: number }[] {
    const cells = [{ x, y }];
    for (let i = 1; i <= range; i++) {
      cells.push({ x: x + i, y }, { x: x - i, y }, { x, y: y + i }, { x, y: y - i });
    }
    return cells;
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    // Silently acknowledge the heartbeat to keep the connection alive.
    // In a real scenario, you might update a last_seen timestamp in Redis here.
  }
}

