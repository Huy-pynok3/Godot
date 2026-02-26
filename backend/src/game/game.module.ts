import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { TreasureModule } from '../treasure/treasure.module';
import { RedisLockService } from '../common/redis-lock.service';

@Module({
  imports: [AuthModule, RedisModule, TreasureModule],
  providers: [GameGateway, RedisLockService],
})
export class GameModule {}
