import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { GridService, MoveRejectionReason } from '../treasure/grid.service';
import { RedisLockService } from '../common/redis-lock.service';
import { HeroService } from '../treasure/hero.service';
import { Socket } from 'socket.io';
import { MoveIntentDto } from './dto/move-intent.dto';
import { BombIntentDto } from './dto/bomb-intent.dto';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRedisService: any;
  let mockGridService: any;
  let mockLockService: any;
  let mockHeroService: any;

  beforeEach(async () => {
    mockJwtService = {
      verifyAsync: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    mockRedisService = {
      set: jest.fn(),
      get: jest.fn(),
      del: jest.fn(),
    };

    mockGridService = {
      validateMove: jest.fn(),
      updateHeroPosition: jest.fn(),
      getHeroPosition: jest.fn(),
      hitChest: jest.fn(),
    };

    mockLockService = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    mockHeroService = {
      getHero: jest.fn(),
      hasSufficientStamina: jest.fn(),
      drainStamina: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
        { provide: GridService, useValue: mockGridService },
        { provide: RedisLockService, useValue: mockLockService },
        { provide: HeroService, useValue: mockHeroService },
      ],
    }).compile();

    gateway = module.get<GameGateway>(GameGateway);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockSocket = (tokenMethod: 'auth' | 'query' | 'header', tokenValue: string | undefined): Socket => {
    const handshake: any = {};

    if (tokenMethod === 'auth') {
      handshake.auth = { token: tokenValue };
    } else if (tokenMethod === 'query') {
      handshake.query = { token: tokenValue };
    } else if (tokenMethod === 'header' && tokenValue) {
      handshake.headers = { authorization: `Bearer ${tokenValue}` };
    }

    const client = {
      id: 'mock-socket-id',
      handshake,
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      data: {},
    } as unknown as Socket;

    return client;
  };

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should disconnect client if no token is provided', async () => {
      const client = createMockSocket('auth', undefined);

      await gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should disconnect client if token is invalid', async () => {
      const client = createMockSocket('auth', 'invalid-token');
      mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      await gateway.handleConnection(client);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('invalid-token', { secret: 'test-secret' });
      expect(client.disconnect).toHaveBeenCalled();
      expect(mockRedisService.set).not.toHaveBeenCalled();
    });

    it('should authenticate and map socket if valid token is in auth payload', async () => {
      const client = createMockSocket('auth', 'valid-token');
      const payload = { sub: 1, walletAddress: '0x123' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await gateway.handleConnection(client);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
      expect(client.data.user).toEqual(payload);
      expect(mockRedisService.set).toHaveBeenCalledWith('connection:0x123', 'mock-socket-id');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate and map socket if valid token is in query params', async () => {
      const client = createMockSocket('query', 'valid-token-query');
      const payload = { sub: 1, walletAddress: '0x456' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await gateway.handleConnection(client);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token-query', { secret: 'test-secret' });
      expect(client.data.user).toEqual(payload);
      expect(mockRedisService.set).toHaveBeenCalledWith('connection:0x456', 'mock-socket-id');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should authenticate and map socket if valid token is in header', async () => {
      const client = createMockSocket('header', 'valid-token-header');
      const payload = { sub: 1, walletAddress: '0x789' };
      mockJwtService.verifyAsync.mockResolvedValue(payload);

      await gateway.handleConnection(client);

      expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token-header', { secret: 'test-secret' });
      expect(client.data.user).toEqual(payload);
      expect(mockRedisService.set).toHaveBeenCalledWith('connection:0x789', 'mock-socket-id');
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('should do nothing if client was not authenticated (no user data)', async () => {
      const client = { id: 'mock-socket-id', data: {} } as unknown as Socket;

      await gateway.handleDisconnect(client);

      expect(mockRedisService.get).not.toHaveBeenCalled();
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });

    it('should delete mapping from redis if socket ID matches', async () => {
      const client = {
        id: 'mock-socket-id',
        data: { user: { walletAddress: '0x123' } }
      } as unknown as Socket;

      mockRedisService.get.mockResolvedValue('mock-socket-id');

      await gateway.handleDisconnect(client);

      expect(mockRedisService.get).toHaveBeenCalledWith('connection:0x123');
      expect(mockRedisService.del).toHaveBeenCalledWith('connection:0x123');
    });

    it('should NOT delete mapping from redis if socket ID does not match (reconnected elsewhere)', async () => {
      const client = {
        id: 'old-mock-socket-id',
        data: { user: { walletAddress: '0x123' } }
      } as unknown as Socket;

      mockRedisService.get.mockResolvedValue('new-mock-socket-id'); // Reconnected!

      await gateway.handleDisconnect(client);

      expect(mockRedisService.get).toHaveBeenCalledWith('connection:0x123');
      expect(mockRedisService.del).not.toHaveBeenCalled();
    });
  });

  describe('handleMoveIntent', () => {
    it('should reject move if stamina is insufficient', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new MoveIntentDto();
      dto.hero_id = 1;
      dto.x = 5;
      dto.y = 10;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockHeroService.getHero.mockResolvedValue({ tokenId: 1, staminaCurrent: 0.1 }); // Low stamina
      mockHeroService.hasSufficientStamina.mockReturnValue(false);

      await gateway.handleMoveIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith(
        'hero_move_rejected',
        expect.objectContaining({
          tokenId: 1,
          reason: MoveRejectionReason.INSUFFICIENT_STAMINA,
        }),
      );
      expect(mockGridService.validateMove).not.toHaveBeenCalled();
    });
    it('should emit hero_move_confirmed with dto data when valid', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new MoveIntentDto();
      dto.hero_id = 1;
      dto.x = 5;
      dto.y = 10;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockHeroService.getHero.mockResolvedValue({ tokenId: 1, staminaCurrent: 10.0 });
      mockHeroService.hasSufficientStamina.mockReturnValue(true);
      mockGridService.validateMove.mockResolvedValue({ valid: true });

      await gateway.handleMoveIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith(
        'hero_move_confirmed',
        expect.objectContaining({
          tokenId: 1,
          position: { x: 5, y: 10 },
        }),
      );
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });

    it('should emit hero_move_rejected when validation fails', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new MoveIntentDto();
      dto.hero_id = 1;
      dto.x = 5;
      dto.y = 10;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockHeroService.getHero.mockResolvedValue({ tokenId: 1, staminaCurrent: 10.0 });
      mockHeroService.hasSufficientStamina.mockReturnValue(true);
      mockGridService.validateMove.mockResolvedValue({
        valid: false,
        reason: MoveRejectionReason.OBSTACLE,
      });

      await gateway.handleMoveIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith(
        'hero_move_rejected',
        expect.objectContaining({
          tokenId: 1,
          reason: MoveRejectionReason.OBSTACLE,
        }),
      );
    });
  });

  describe('handleBombIntent', () => {
    it('should validate bomb, drain stamina, and emit confirmed and updated stamina', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new BombIntentDto();
      dto.hero_id = 123;
      dto.x = 5;
      dto.y = 5;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockGridService.getHeroPosition.mockResolvedValue({ x: 5, y: 5 });
      mockHeroService.getHero.mockResolvedValue({ tokenId: 123, staminaCurrent: 10.0, power: 1, bombRange: 2 });
      mockHeroService.hasSufficientStamina.mockReturnValue(true);
      mockHeroService.drainStamina.mockResolvedValue({ tokenId: 123, staminaCurrent: 9.0 }); // New mock
      mockGridService.hitChest.mockResolvedValue({ hit: false, destroyed: false });

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      (gateway as any).server = mockServer;

      await gateway.handleBombIntent(dto, client);

      expect(mockLockService.acquireLock).toHaveBeenCalled();
      expect(mockHeroService.drainStamina).toHaveBeenCalledWith(123);
      expect(client.emit).toHaveBeenCalledWith('bomb_validated', expect.objectContaining({ hero_id: 123, x: 5, y: 5 }));
      expect(mockServer.to).toHaveBeenCalledWith('session:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('stamina_updated', expect.objectContaining({ hero_id: 123, stamina: 9.0 }));
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });

    it('should emit chest_destroyed when a chest is destroyed', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new BombIntentDto();
      dto.hero_id = 123;
      dto.x = 5;
      dto.y = 5;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockGridService.getHeroPosition.mockResolvedValue({ x: 5, y: 5 });
      mockHeroService.getHero.mockResolvedValue({ tokenId: 123, staminaCurrent: 10, power: 1, bombRange: 1 });
      mockHeroService.hasSufficientStamina.mockReturnValue(true);
      mockHeroService.drainStamina.mockResolvedValue({ tokenId: 123, staminaCurrent: 9.0 });

      const mockServer = {
        to: jest.fn().mockReturnThis(),
        emit: jest.fn(),
      };
      (gateway as any).server = mockServer;

      // Center hit
      mockGridService.hitChest.mockResolvedValueOnce({ hit: true, destroyed: true });
      // Others miss
      mockGridService.hitChest.mockResolvedValue({ hit: false, destroyed: false });

      await gateway.handleBombIntent(dto, client);

      expect(mockServer.to).toHaveBeenCalledWith('session:user-1');
      expect(mockServer.emit).toHaveBeenCalledWith('chest_destroyed', expect.objectContaining({ x: 5, y: 5, hero_id: 123 }));
    });

    it('should reject if position mismatch', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new BombIntentDto();
      dto.hero_id = 123;
      dto.x = 5;
      dto.y = 5;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockGridService.getHeroPosition.mockResolvedValue({ x: 10, y: 10 }); // Mismatch

      await gateway.handleBombIntent(dto, client);

      expect(mockHeroService.drainStamina).not.toHaveBeenCalled();
      expect(client.emit).not.toHaveBeenCalledWith('bomb_validated', expect.any(Object));
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });

    it('should reject if stamina insufficient', async () => {
      const client = createMockSocket('auth', 'valid');
      client.data.user = { id: 'user-1' };
      const dto = new BombIntentDto();
      dto.hero_id = 123;
      dto.x = 5;
      dto.y = 5;

      mockLockService.acquireLock.mockResolvedValue(true);
      mockGridService.getHeroPosition.mockResolvedValue({ x: 5, y: 5 });
      mockHeroService.getHero.mockResolvedValue({ tokenId: 123, staminaCurrent: 0.5 });
      mockHeroService.hasSufficientStamina.mockReturnValue(false);

      await gateway.handleBombIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith('hero_bomb_rejected', expect.objectContaining({ hero_id: 123, reason: MoveRejectionReason.INSUFFICIENT_STAMINA }));
      expect(mockHeroService.drainStamina).not.toHaveBeenCalled();
      expect(mockLockService.releaseLock).toHaveBeenCalled();
    });
  });

  describe('handleHeartbeat', () => {
    it('should silently accept heartbeat message without throwing or emitting', () => {
      const client = createMockSocket('auth', 'valid');

      expect(() => {
        gateway.handleHeartbeat(client);
      }).not.toThrow();

      expect(client.emit).not.toHaveBeenCalled();
    });
  });
});
