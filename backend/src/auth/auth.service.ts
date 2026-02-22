import { Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { verifyMessage } from 'ethers';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async generateNonce(walletAddress: string): Promise<string> {
    try {
      const nonce = crypto.randomBytes(32).toString('hex');
      const key = `user:${walletAddress.toLowerCase()}:nonce`;
      const ttl = 300; // 5 minutes in seconds

      await this.redisService.set(key, nonce, ttl);

      return nonce;
    } catch (error) {
      throw new InternalServerErrorException('Failed to generate nonce');
    }
  }

  async verifySignatureAndLogin(walletAddress: string, signature: string): Promise<{ accessToken: string }> {
    const normalizedAddress = walletAddress.toLowerCase();
    const key = `user:${normalizedAddress}:nonce`;
    const nonce = await this.redisService.get(key);

    // Immediately delete the nonce to prevent replay attacks
    if (nonce) {
      await this.redisService.del(key);
    }

    if (!nonce) {
      throw new UnauthorizedException('Invalid or expired nonce');
    }

    try {
      const recoveredAddress = verifyMessage(nonce, signature);
      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new UnauthorizedException('Signature verification failed');
      }
    } catch (error) {
      throw new UnauthorizedException('Invalid signature');
    }

    // Check if user exists, if not create one
    let user = await this.prisma.user.findUnique({
      where: { walletAddress: normalizedAddress },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          walletAddress: normalizedAddress,
        },
      });
    }

    // Generate JWT
    const payload = { sub: user.id, walletAddress: user.walletAddress };
    const accessToken = this.jwtService.sign(payload);

    return { accessToken };
  }
}
