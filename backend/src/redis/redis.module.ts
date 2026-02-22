import { Module } from '@nestjs/common';
import { RedisModule as NestJsRedisModule } from '@nestjs-modules/ioredis';
import { RedisService } from './redis.service';

@Module({
  imports: [
    NestJsRedisModule.forRoot({
      type: 'single',
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    }),
  ],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
