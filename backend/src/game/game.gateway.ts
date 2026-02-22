import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { MoveIntentDto } from './dto/move-intent.dto';
import { BombIntentDto } from './dto/bomb-intent.dto';

@UsePipes(new ValidationPipe({
  transform: true,
  exceptionFactory: (errors) => new WsException(errors),
}))
@WebSocketGateway({ namespace: 'game' })
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
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
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET', 'super-secret-default-key-for-dev'),
      });

      // Attach the payload to the socket object
      client.data.user = payload;

      // Store connection mapping in Redis: walletAddress -> socketId
      const walletAddress = payload.walletAddress;
      await this.redisService.set(`connection:${walletAddress}`, client.id);

      this.logger.log(`Client connected successfully: ${client.id} (Wallet: ${walletAddress})`);
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
  handleMoveIntent(
    @MessageBody() moveIntentDto: MoveIntentDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Stub implementation for now
    this.logger.log(`Received move_intent from ${client.id}: hero ${moveIntentDto.hero_id} to (${moveIntentDto.x}, ${moveIntentDto.y})`);
    client.emit('hero_move_confirmed', { hero_id: moveIntentDto.hero_id, x: moveIntentDto.x, y: moveIntentDto.y });
  }

  @SubscribeMessage('bomb_intent')
  handleBombIntent(
    @MessageBody() bombIntentDto: BombIntentDto,
    @ConnectedSocket() client: Socket,
  ) {
    // Stub implementation for now
    this.logger.log(`Received bomb_intent from ${client.id}: hero ${bombIntentDto.hero_id} at (${bombIntentDto.x}, ${bombIntentDto.y})`);
    client.emit('bomb_validated', { hero_id: bombIntentDto.hero_id, x: bombIntentDto.x, y: bombIntentDto.y, chest_destroyed: false });
  }

  @SubscribeMessage('heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    // Silently acknowledge the heartbeat to keep the connection alive.
    // In a real scenario, you might update a last_seen timestamp in Redis here.
  }
}

