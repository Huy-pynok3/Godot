import { Test, TestingModule } from '@nestjs/testing';
import { TreasureService } from './treasure.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TreasureService', () => {
  let service: TreasureService;
  let prisma: PrismaService;
  let redis: RedisService;

  const mockPrismaService = {
    treasureSession: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreasureService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<TreasureService>(TreasureService);
    prisma = module.get<PrismaService>(PrismaService);
    redis = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startSession', () => {
    it('should create new session when no active session exists', async () => {
      mockPrismaService.treasureSession.findFirst.mockResolvedValue(null);
      mockPrismaService.treasureSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
        status: 'ACTIVE',
        chestState: null,
        startTime: new Date(),
        endTime: null,
      });
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.startSession('user-123');

      expect(result.sessionId).toBe('session-1');
      expect(result.status).toBe('ACTIVE');
      expect(result.gridData).toHaveLength(40);
      expect(result.gridSize).toEqual({ width: 20, height: 15 });
      expect(redis.set).toHaveBeenCalledWith(
        'session:user-123:grid',
        expect.any(String),
        86400,
      );
    });

    it('should throw ConflictException when active session exists', async () => {
      const existingSession = {
        id: 'session-1',
        userId: 'user-123',
        status: 'ACTIVE',
        chestState: null,
        startTime: new Date(),
        endTime: null,
      };
      const cachedGrid = JSON.stringify([{ x: 0, y: 0, hp: 2 }]);

      mockPrismaService.treasureSession.findFirst.mockResolvedValue(existingSession);
      mockRedisService.get.mockResolvedValue(cachedGrid);

      await expect(service.startSession('user-123')).rejects.toThrow(ConflictException);
      await expect(service.startSession('user-123')).rejects.toThrow('Active session already exists');
      expect(prisma.treasureSession.create).not.toHaveBeenCalled();
    });

    it('should generate grid with correct dimensions and chest count', async () => {
      mockPrismaService.treasureSession.findFirst.mockResolvedValue(null);
      mockPrismaService.treasureSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
        status: 'ACTIVE',
        chestState: null,
        startTime: new Date(),
        endTime: null,
      });
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.startSession('user-123');

      expect(result.gridData).toHaveLength(40);
      result.gridData.forEach((chest) => {
        expect(chest.x).toBeGreaterThanOrEqual(0);
        expect(chest.x).toBeLessThan(20);
        expect(chest.y).toBeGreaterThanOrEqual(0);
        expect(chest.y).toBeLessThan(15);
        expect(chest.hp).toBeGreaterThanOrEqual(1);
        expect(chest.hp).toBeLessThanOrEqual(3);
      });
    });

    it('should generate non-overlapping chest positions', async () => {
      mockPrismaService.treasureSession.findFirst.mockResolvedValue(null);
      mockPrismaService.treasureSession.create.mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
        status: 'ACTIVE',
        chestState: null,
        startTime: new Date(),
        endTime: null,
      });
      mockRedisService.set.mockResolvedValue('OK');

      const result = await service.startSession('user-123');

      const positions = new Set(result.gridData.map((c) => `${c.x},${c.y}`));
      expect(positions.size).toBe(result.gridData.length);
    });
  });

  describe('stopSession', () => {
    it('should update session status to COMPLETED and clear Redis cache', async () => {
      const activeSession = {
        id: 'session-1',
        userId: 'user-123',
        status: 'ACTIVE',
        chestState: null,
        startTime: new Date(),
        endTime: null,
      };

      mockPrismaService.treasureSession.findFirst.mockResolvedValue(activeSession);
      mockPrismaService.treasureSession.update.mockResolvedValue({
        ...activeSession,
        status: 'COMPLETED',
        endTime: new Date(),
      });
      mockRedisService.del.mockResolvedValue(1);

      const result = await service.stopSession('user-123');

      expect(result.sessionId).toBe('session-1');
      expect(result.status).toBe('COMPLETED');
      expect(result.message).toBe('Session stopped successfully');
      expect(prisma.treasureSession.update).toHaveBeenCalledWith({
        where: { id: 'session-1' },
        data: { status: 'COMPLETED' },
      });
      expect(redis.del).toHaveBeenCalledWith('session:user-123:grid');
    });

    it('should throw NotFoundException when no active session exists', async () => {
      mockPrismaService.treasureSession.findFirst.mockResolvedValue(null);

      await expect(service.stopSession('user-123')).rejects.toThrow(NotFoundException);
      await expect(service.stopSession('user-123')).rejects.toThrow('No active session found');
    });
  });
});
