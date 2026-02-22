import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { WalletLoginDto } from './dto/wallet-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('nonce')
  @HttpCode(HttpStatus.OK)
  async generateNonce(@Body() body: NonceRequestDto): Promise<{ nonce: string }> {
    const nonce = await this.authService.generateNonce(body.walletAddress);
    return { nonce };
  }

  @Post('wallet-login')
  @HttpCode(HttpStatus.OK)
  async walletLogin(@Body() body: WalletLoginDto): Promise<{ accessToken: string }> {
    return this.authService.verifySignatureAndLogin(body.walletAddress, body.signature);
  }
}
