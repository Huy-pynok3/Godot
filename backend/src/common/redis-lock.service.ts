import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisLockService {
  private readonly logger = new Logger(RedisLockService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Acquire a distributed lock with TTL
   * @param key Lock key (e.g., 'lock:hero_action:123')
   * @param ttlMs Time-to-live in milliseconds
   * @returns true if lock acquired, false if already locked
   */
  async acquireLock(key: string, ttlMs: number): Promise<boolean> {
    try {
      const result = await this.redis.set(
        key,
        Date.now().toString(),
        'NX',
        'PX',
        ttlMs,
      );
      const acquired = result === 'OK';

      if (!acquired) {
        this.logger.warn(`Lock acquisition failed: ${key}`);
      }

      return acquired;
    } catch (error) {
      this.logger.error(`Redis lock error: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * @param key Lock key
   */
  async releaseLock(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Redis unlock error: ${error.message}`, error.stack);
    }
  }
}
