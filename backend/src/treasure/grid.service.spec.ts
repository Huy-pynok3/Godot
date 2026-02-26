import { Test, TestingModule } from '@nestjs/testing';
import { GridService, MoveRejectionReason } from './grid.service';
import { RedisService } from '../redis/redis.service';

describe('GridService', () => {
  let service: GridService;
  let redis: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GridService,
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            eval: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GridService>(GridService);
    redis = module.get<RedisService>(RedisService);
  });

  describe('loadGrid', () => {
    it('should return parsed grid from Redis', async () => {
      const grid = [
        { x: 0, y: 0, hp: 2 },
        { x: 5, y: 5, hp: 3 },
      ];
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(grid));

      const result = await service.loadGrid('user-1');

      expect(result).toEqual(grid);
      expect(redis.get).toHaveBeenCalledWith('session:user-1:grid');
    });

    it('should return null when grid not found', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);

      const result = await service.loadGrid('user-1');

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue('invalid json');

      const result = await service.loadGrid('user-1');

      expect(result).toBeNull();
    });
  });

  describe('getHeroPosition', () => {
    it('should return position from Redis', async () => {
      const position = { x: 5, y: 7 };
      jest.spyOn(redis, 'get').mockResolvedValue(JSON.stringify(position));

      const result = await service.getHeroPosition('user-1', 123);

      expect(result).toEqual(position);
      expect(redis.get).toHaveBeenCalledWith('hero:user-1:123:position');
    });

    it('should return null when position not found', async () => {
      jest.spyOn(redis, 'get').mockResolvedValue(null);

      const result = await service.getHeroPosition('user-1', 123);

      expect(result).toBeNull();
    });
  });

  describe('updateHeroPosition', () => {
    it('should store position in Redis with TTL', async () => {
      await service.updateHeroPosition('user-1', 123, { x: 5, y: 5 });

      expect(redis.set).toHaveBeenCalledWith(
        'hero:user-1:123:position',
        JSON.stringify({ x: 5, y: 5 }),
        86400,
      );
    });
  });

  describe('validateMove', () => {
    it('should accept valid adjacent move', async () => {
      const grid = [{ x: 5, y: 5, hp: 2 }];
      jest
        .spyOn(redis, 'get')
        .mockResolvedValueOnce(JSON.stringify(grid))
        .mockResolvedValueOnce(JSON.stringify({ x: 3, y: 3 }));

      const result = await service.validateMove('user-1', 123, 3, 4);

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject move to obstacle', async () => {
      const grid = [{ x: 3, y: 4, hp: 2 }];
      jest
        .spyOn(redis, 'get')
        .mockResolvedValueOnce(JSON.stringify(grid))
        .mockResolvedValueOnce(JSON.stringify({ x: 3, y: 3 }));

      const result = await service.validateMove('user-1', 123, 3, 4);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(MoveRejectionReason.OBSTACLE);
    });

    it('should reject out of bounds move', async () => {
      const grid = [];
      jest
        .spyOn(redis, 'get')
        .mockResolvedValueOnce(JSON.stringify(grid))
        .mockResolvedValueOnce(JSON.stringify({ x: 19, y: 14 }));

      const result = await service.validateMove('user-1', 123, 20, 14);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(MoveRejectionReason.OUT_OF_BOUNDS);
    });

    it('should reject non-adjacent move', async () => {
      const grid = [];
      jest
        .spyOn(redis, 'get')
        .mockResolvedValueOnce(JSON.stringify(grid))
        .mockResolvedValueOnce(JSON.stringify({ x: 3, y: 3 }));

      const result = await service.validateMove('user-1', 123, 5, 5);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(MoveRejectionReason.INVALID_PATH);
    });

    it('should reject when grid not found', async () => {
      jest.spyOn(redis, 'get').mockResolvedValueOnce(null);

      const result = await service.validateMove('user-1', 123, 3, 4);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(MoveRejectionReason.NO_SESSION);
    });

    it('should reject when hero position not found', async () => {
      const grid = [];
      jest
        .spyOn(redis, 'get')
        .mockResolvedValueOnce(JSON.stringify(grid))
        .mockResolvedValueOnce(null);

      const result = await service.validateMove('user-1', 123, 3, 4);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe(MoveRejectionReason.NO_POSITION);
    });
  });

  describe('hitChest', () => {
    it('should call Redis eval with correct Lua script and arguments', async () => {
      jest.spyOn(redis, 'eval').mockResolvedValue([1, 0]);

      const result = await service.hitChest('user-1', 5, 5);

      expect(result.hit).toBe(true);
      expect(result.destroyed).toBe(false);
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('cjson.decode'),
        ['session:user-1:grid'],
        [5, 5],
      );
    });

    it('should return destroyed true when Lua script returns 1 for destroyed', async () => {
      jest.spyOn(redis, 'eval').mockResolvedValue([1, 1]);

      const result = await service.hitChest('user-1', 5, 5);

      expect(result.hit).toBe(true);
      expect(result.destroyed).toBe(true);
    });

    it('should return hit false if Lua script returns 0', async () => {
      jest.spyOn(redis, 'eval').mockResolvedValue([0, 0]);

      const result = await service.hitChest('user-1', 10, 10);

      expect(result.hit).toBe(false);
      expect(result.destroyed).toBe(false);
    });
  });
});
