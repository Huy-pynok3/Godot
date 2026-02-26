import { Test, TestingModule } from '@nestjs/testing';
import { HeroService } from './hero.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HeroService', () => {
  let service: HeroService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroService,
        {
          provide: PrismaService,
          useValue: {
            hero: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<HeroService>(HeroService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHero', () => {
    it('should return hero and apply lazy regeneration if needed', async () => {
      const now = new Date();
      const lastUpdate = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
      const mockHero = {
        tokenId: 123,
        staminaCurrent: 5.0,
        staminaMax: 10,
        lastRestTime: lastUpdate,
      };
      (prisma.hero.findUnique as jest.Mock).mockResolvedValue(mockHero);
      (prisma.hero.update as jest.Mock).mockImplementation((args) => Promise.resolve({
        ...mockHero,
        staminaCurrent: args.data.staminaCurrent,
        lastRestTime: args.data.lastRestTime,
      }));

      // 0.5 regen/hour, so 1 hour = 0.5 more stamina
      const result = await service.getHero(123);

      expect(result.staminaCurrent).toBeCloseTo(5.5, 5);
      expect(prisma.hero.update).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          tokenId: 123,
          lastRestTime: lastUpdate,
        },
        data: expect.objectContaining({
          staminaCurrent: expect.any(Number),
        }),
      }));
    });

    it('should clamp stamina to staminaMax during regeneration', async () => {
      const now = new Date();
      const lastUpdate = new Date(now.getTime() - 24 * 3600 * 1000); // 24 hours ago
      const mockHero = {
        tokenId: 123,
        staminaCurrent: 9.0,
        staminaMax: 10,
        lastRestTime: lastUpdate,
      };
      (prisma.hero.findUnique as jest.Mock).mockResolvedValue(mockHero);
      (prisma.hero.update as jest.Mock).mockImplementation((args) =>
        Promise.resolve({
          ...mockHero,
          staminaCurrent: args.data.staminaCurrent,
          lastRestTime: args.data.lastRestTime,
        }),
      );

      const result = await service.getHero(123);

      expect(result.staminaCurrent).toBe(10.0);
      expect(prisma.hero.update).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          tokenId: 123,
          lastRestTime: lastUpdate,
        },
        data: expect.objectContaining({
          staminaCurrent: 10.0,
        }),
      }));
    });

    it('should NOT update database if no regeneration occurs (already max)', async () => {
      const now = new Date();
      const lastUpdate = new Date(now.getTime() - 100); // Very recent
      const mockHero = {
        tokenId: 123,
        staminaCurrent: 10.0,
        staminaMax: 10,
        lastRestTime: lastUpdate,
      };
      (prisma.hero.findUnique as jest.Mock).mockResolvedValue(mockHero);
      (prisma.hero.update as jest.Mock).mockResolvedValue({
        ...mockHero,
        staminaCurrent: 10.0,
      });

      const result = await service.getHero(123);

      expect(result.staminaCurrent).toBe(10.0);
      expect(prisma.hero.update).not.toHaveBeenCalled();
    });
  });

  describe('hasSufficientStamina', () => {
    it('should return true if stamina > 1.0', () => {
      const hero = { staminaCurrent: 1.5 } as any;
      expect(service.hasSufficientStamina(hero)).toBe(true);
    });

    it('should return false if stamina <= 1.0', () => {
      const hero = { staminaCurrent: 1.0 } as any;
      expect(service.hasSufficientStamina(hero)).toBe(false);
    });
  });

  describe('drainStamina', () => {
    it('should decrement stamina by 1.0', async () => {
      const mockHero = { tokenId: 123, staminaCurrent: 10.0 };
      (prisma.hero.update as jest.Mock).mockResolvedValue(mockHero);

      await service.drainStamina(123);

      expect(prisma.hero.update).toHaveBeenCalledWith({
        where: { tokenId: 123 },
        data: {
          staminaCurrent: {
            decrement: 1.0,
          },
        },
      });
    });
  });
});
