import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnApplicationBootstrap {
  private readonly logger = new Logger(RedisService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async onApplicationBootstrap() {
    try {
      const pingResult = await this.redis.ping();
      if (pingResult === 'PONG') {
        this.logger.log('Successfully connected to Redis');
      } else {
        this.logger.warn(`Unexpected Redis PING response: ${pingResult}`);
      }
    } catch (error) {
      this.logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  /**
   * Get the value of a key.
   * @param key The key to get
   * @returns The string value, or null if the key does not exist
   */
  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  /**
   * Set key to hold the string value.
   * @param key The key to set
   * @param value The value to set
   * @param ttlSeconds Optional time-to-live in seconds
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  /**
   * Set key to hold string value if key does not exist.
   * @param key The key to set
   * @param value The value to set
   * @param ttlSeconds Time-to-live in seconds
   * @returns true if the key was set, false if the key already existed
   */
  async setnx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    // Set the value only if it does not exist (NX), and set expiry (EX)
    const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Delete a key.
   * @param key The key to delete
   */
  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Execute a Lua script in Redis.
   * @param script The Lua script to execute
   * @param keys The keys that the script will access
   * @param args The arguments to pass to the script
   * @returns The script result
   */
  async eval(script: string, keys: string[], args: any[]): Promise<any> {
    return this.redis.eval(script, keys.length, ...keys, ...args);
  }
}
