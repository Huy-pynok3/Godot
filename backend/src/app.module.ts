import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { GameModule } from './game/game.module';
import { TreasureModule } from './treasure/treasure.module';

@Module({
  imports: [PrismaModule, RedisModule, AuthModule, GameModule, TreasureModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
