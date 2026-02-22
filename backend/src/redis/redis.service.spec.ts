import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
import { Logger } from '@nestjs/common';

describe('RedisService', () => {
  let service: RedisService;
  let redisMock: any;

  beforeEach(async () => {
    redisMock = {
      ping: jest.fn().mockResolvedValue('PONG'),
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: getRedisConnectionToken('default'),
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);

    // Clean mock for logger functions directly since it's a private property
    const mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    (service as any).logger = mockLogger;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onApplicationBootstrap', () => {
    it('should ping redis and log success', async () => {
      const loggerSpy = jest.spyOn((service as any).logger, 'log');
      await service.onApplicationBootstrap();
      expect(redisMock.ping).toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith('Successfully connected to Redis');
    });

    it('should throw an error if ping fails', async () => {
      redisMock.ping.mockRejectedValue(new Error('Redis connection failed'));
      await expect(service.onApplicationBootstrap()).rejects.toThrow('Redis connection failed');
    });
  });

  describe('get', () => {
    it('should call redis.get with the correct key', async () => {
      redisMock.get.mockResolvedValue('testValue');
      const result = await service.get('testKey');
      expect(redisMock.get).toHaveBeenCalledWith('testKey');
      expect(result).toBe('testValue');
    });

    it('should return null if key does not exist', async () => {
      redisMock.get.mockResolvedValue(null);
      const result = await service.get('missingKey');
      expect(redisMock.get).toHaveBeenCalledWith('missingKey');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should call redis.set without TTL', async () => {
      await service.set('testKey', 'testValue');
      expect(redisMock.set).toHaveBeenCalledWith('testKey', 'testValue');
    });

    it('should call redis.set with TTL', async () => {
      await service.set('testKey', 'testValue', 60);
      expect(redisMock.set).toHaveBeenCalledWith('testKey', 'testValue', 'EX', 60);
    });
  });

  describe('setnx', () => {
    it('should return true if key was set successfully', async () => {
      redisMock.set.mockResolvedValue('OK');
      const result = await service.setnx('lockKey', 'lockValue', 30);
      expect(redisMock.set).toHaveBeenCalledWith('lockKey', 'lockValue', 'EX', 30, 'NX');
      expect(result).toBe(true);
    });

    it('should return false if key already exists (setnx fails)', async () => {
      redisMock.set.mockResolvedValue(null);
      const result = await service.setnx('lockKey', 'lockValue', 30);
      expect(redisMock.set).toHaveBeenCalledWith('lockKey', 'lockValue', 'EX', 30, 'NX');
      expect(result).toBe(false);
    });
  });
});
