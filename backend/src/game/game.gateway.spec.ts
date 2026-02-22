import { Test, TestingModule } from '@nestjs/testing';
import { GameGateway } from './game.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { Socket } from 'socket.io';
import { MoveIntentDto } from './dto/move-intent.dto';
import { BombIntentDto } from './dto/bomb-intent.dto';

describe('GameGateway', () => {
  let gateway: GameGateway;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockRedisService: any;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: RedisService, useValue: mockRedisService },
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

    return {
      id: 'mock-socket-id',
      handshake,
      disconnect: jest.fn(),
      emit: jest.fn(),
      data: {},
    } as unknown as Socket;
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
    it('should emit hero_move_confirmed with dto data', () => {
      const client = createMockSocket('auth', 'valid');
      const dto = new MoveIntentDto();
      dto.hero_id = 1;
      dto.x = 5;
      dto.y = 10;

      gateway.handleMoveIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith('hero_move_confirmed', { hero_id: 1, x: 5, y: 10 });
    });
  });

  describe('handleBombIntent', () => {
    it('should emit bomb_validated with dto data', () => {
      const client = createMockSocket('auth', 'valid');
      const dto = new BombIntentDto();
      dto.hero_id = 1;
      dto.x = 5;
      dto.y = 10;

      gateway.handleBombIntent(dto, client);

      expect(client.emit).toHaveBeenCalledWith('bomb_validated', { hero_id: 1, x: 5, y: 10, chest_destroyed: false });
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
