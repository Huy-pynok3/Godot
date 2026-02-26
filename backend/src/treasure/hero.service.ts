import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HeroService {
  private readonly logger = new Logger(HeroService.name);
  public static readonly STAMINA_DRAIN_PER_BOMB = 1.0;
  public static readonly STAMINA_REGEN_PER_HOUR = 0.5;
  private static readonly MS_PER_HOUR = 1000 * 3600;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get hero by tokenId and apply lazy regeneration
   */
  async getHero(tokenId: number) {
    // 1. Fetch current state
    const hero = await this.prisma.hero.findUnique({
      where: { tokenId },
    });

    if (!hero) return null;

    // 2. Apply lazy regeneration
    return this.applyLazyRegeneration(hero);
  }

  /**
   * Calculate and apply stamina regeneration based on time elapsed
   * Uses atomic update logic
   */
  private async applyLazyRegeneration(hero: any) {
    const now = new Date();
    const lastUpdate = hero.lastRestTime ? new Date(hero.lastRestTime) : now;
    const hoursElapsed =
      (now.getTime() - lastUpdate.getTime()) / HeroService.MS_PER_HOUR;

    if (hoursElapsed <= 0.001) return hero;

    const regenAmount = hoursElapsed * HeroService.STAMINA_REGEN_PER_HOUR;
    const targetStamina = hero.staminaCurrent + regenAmount;

    if (targetStamina <= hero.staminaCurrent) return hero;

    try {
      // Atomic update with concurrency check (where: lastRestTime matches)
      // If someone else updated it, this will fail or do nothing, which is fine
      // because the next call will re-calculate from the new state.
      const updatedHero = await this.prisma.hero.update({
        where: {
          tokenId: hero.tokenId,
          // Optimistic locking / Concurrency guard
          lastRestTime: hero.lastRestTime,
        },
        data: {
          staminaCurrent: Math.min(hero.staminaMax, targetStamina),
          lastRestTime: now,
        },
      });
      return updatedHero;
    } catch (error) {
      // If update fails due to P2025 (Record not found because lastRestTime changed),
      // re-fetch and retry once or just return the latest from DB
      this.logger.warn(
        `Lazy regen concurrency hit for hero ${hero.tokenId}, retrying fetch`,
      );
      return this.prisma.hero.findUnique({ where: { tokenId: hero.tokenId } });
    }
  }

  /**
   * Check if hero has sufficient stamina for a bomb action
   */
  hasSufficientStamina(hero: { staminaCurrent: number }): boolean {
    return hero.staminaCurrent > HeroService.STAMINA_DRAIN_PER_BOMB;
  }

  /**
   * Drain stamina from hero for a bomb action
   */
  async drainStamina(tokenId: number) {
    try {
      const updatedHero = await this.prisma.hero.update({
        where: { tokenId },
        data: {
          staminaCurrent: {
            decrement: HeroService.STAMINA_DRAIN_PER_BOMB,
          },
        },
      });
      this.logger.log(
        `Drained ${HeroService.STAMINA_DRAIN_PER_BOMB} stamina from hero ${tokenId}`,
      );
      return updatedHero;
    } catch (error) {
      this.logger.error(
        `Failed to drain stamina for hero ${tokenId}`,
        error.stack,
      );
      throw error;
    }
  }
}
