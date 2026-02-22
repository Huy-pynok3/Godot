import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import * as ethers from 'ethers';

// Mock ethers.verifyMessage
jest.mock('ethers', () => {
  const original = jest.requireActual('ethers');
  return {
    ...original,
    verifyMessage: jest.fn(),
  };
});

describe('AuthService', () => {
  let service: AuthService;
  let redisService: RedisService;
  let prismaService: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            get: jest.fn(),
            del: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateNonce', () => {
    it('should generate a 64-character hex nonce and store it in Redis with lowercased key and 5 min TTL', async () => {
      const walletAddress = '0xAbCdEf1234567890aBCdeF1234567890aBCDef12';
      const expectedKey = `user:0xabcdef1234567890abcdef1234567890abcdef12:nonce`;
      const expectedTtl = 300; // 5 minutes

      jest.spyOn(redisService, 'set').mockResolvedValue(undefined);

      const nonce = await service.generateNonce(walletAddress);

      // Verify a nonce was returned and has length 64 (32 bytes hex encoded)
      expect(nonce).toBeDefined();
      expect(nonce.length).toBe(64);

      // Verify Redis was called with the correct parameters
      expect(redisService.set).toHaveBeenCalledWith(expectedKey, nonce, expectedTtl);
    });

    it('should throw InternalServerErrorException if redis.set fails', async () => {
      const walletAddress = '0x123';
      jest.spyOn(redisService, 'set').mockRejectedValue(new Error('Redis error'));

      await expect(service.generateNonce(walletAddress)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('verifySignatureAndLogin', () => {
    const walletAddress = '0x1234567890123456789012345678901234567890';
    const normalizedAddress = walletAddress.toLowerCase();
    const signature = '0xvalid-signature';
    const validNonce = 'test-nonce-string';
    const mockUser = { id: 1, walletAddress: normalizedAddress };
    const mockToken = 'mock-jwt-token';
    const redisKey = `user:${normalizedAddress}:nonce`;

    it('should verify signature, create user if not exists, and return JWT', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(validNonce);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);
      (ethers.verifyMessage as jest.Mock).mockReturnValue(walletAddress); // Same address
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.user, 'create').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const result = await service.verifySignatureAndLogin(walletAddress, signature);

      expect(redisService.get).toHaveBeenCalledWith(redisKey);
      expect(redisService.del).toHaveBeenCalledWith(redisKey);
      expect(ethers.verifyMessage).toHaveBeenCalledWith(validNonce, signature);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({ where: { walletAddress: normalizedAddress } });
      expect(prismaService.user.create).toHaveBeenCalledWith({ data: { walletAddress: normalizedAddress } });
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: mockUser.id, walletAddress: mockUser.walletAddress });
      expect(result).toEqual({ accessToken: mockToken });
    });

    it('should verify signature, use existing user, and return JWT', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(validNonce);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);
      (ethers.verifyMessage as jest.Mock).mockReturnValue(walletAddress); // Same address
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue(mockToken);

      const result = await service.verifySignatureAndLogin(walletAddress, signature);

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({ where: { walletAddress: normalizedAddress } });
      expect(prismaService.user.create).not.toHaveBeenCalled();
      expect(result).toEqual({ accessToken: mockToken });
    });

    it('should throw UnauthorizedException if nonce is missing (or expired) in Redis', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(null); // Missing nonce

      await expect(service.verifySignatureAndLogin(walletAddress, signature)).rejects.toThrow(UnauthorizedException);
      expect(redisService.del).not.toHaveBeenCalled();
      expect(ethers.verifyMessage).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if signature recovery fails (throws error)', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(validNonce);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);
      (ethers.verifyMessage as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature format');
      });

      await expect(service.verifySignatureAndLogin(walletAddress, signature)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if recovered address does not match provided walletAddress', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValue(validNonce);
      jest.spyOn(redisService, 'del').mockResolvedValue(undefined);
      (ethers.verifyMessage as jest.Mock).mockReturnValue('0xDIFFERENT_ADDRESS');

      await expect(service.verifySignatureAndLogin(walletAddress, signature)).rejects.toThrow(UnauthorizedException);
    });
  });
});
