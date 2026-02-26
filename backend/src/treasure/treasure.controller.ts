import { Controller, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { TreasureService } from './treasure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartSessionResponseDto } from './dto/start-session-response.dto';
import { StopSessionResponseDto } from './dto/stop-session-response.dto';

@Controller('treasure')
@UseGuards(JwtAuthGuard)
export class TreasureController {
  constructor(private readonly treasureService: TreasureService) {}

  @Post('start')
  @HttpCode(HttpStatus.CREATED)
  async startSession(@Req() req): Promise<StartSessionResponseDto> {
    const userId = req.user.id;
    return this.treasureService.startSession(userId);
  }

  @Post('stop')
  async stopSession(@Req() req): Promise<StopSessionResponseDto> {
    const userId = req.user.id;
    return this.treasureService.stopSession(userId);
  }
}
