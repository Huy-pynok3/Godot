import { Test, TestingModule } from '@nestjs/testing';
import { RedisLockService } from './redis-lock.service';
import { RedisService } from '../redis/redis.service';

describe('RedisLockService', () => {
  let service: RedisLockService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisLockService,
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RedisLockService>(RedisLockService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('acquireLock', () => {
    it('should return true when lock acquired', async () => {
      jest.spyOn(redis, 'set').mockResolvedValue('OK');

      const result = await service.acquireLock('lock:test', 500);

      expect(result).toBe(true);
      expect(redis.set).toHaveBeenCalledWith(
        'lock:test',
        expect.any(String),
        'NX',
        'PX',
        500,
      );
    });

    it('should return false when lock already held', async () => {
      jest.spyOn(redis, 'set').mockResolvedValue(null);

      const result = await service.acquireLock('lock:test', 500);

      expect(result).toBe(false);
    });

    it('should return false on Redis error', async () => {
      jest.spyOn(redis, 'set').mockRejectedValue(new Error('Redis error'));

      const result = await service.acquireLock('lock:test', 500);

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should delete lock key', async () => {
      await service.releaseLock('lock:test');

      expect(redis.del).toHaveBeenCalledWith('lock:test');
    });

    it('should not throw on Redis error', async () => {
      jest.spyOn(redis, 'del').mockRejectedValue(new Error('Redis error'));

      await expect(service.releaseLock('lock:test')).resolves.not.toThrow();
    });
  });
});
