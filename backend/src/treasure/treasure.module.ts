import { Module } from '@nestjs/common';
import { TreasureController } from './treasure.controller';
import { TreasureService } from './treasure.service';
import { GridService } from './grid.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule],
  controllers: [TreasureController],
  providers: [TreasureService, GridService],
  exports: [TreasureService, GridService],
})
export class TreasureModule {}
