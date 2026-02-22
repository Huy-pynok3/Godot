import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { NonceRequestDto } from './dto/nonce-request.dto';
import { WalletLoginDto } from './dto/wallet-login.dto';
import { InternalServerErrorException, UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateNonce: jest.fn(),
            verifySignatureAndLogin: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateNonce', () => {
    it('should call authService.generateNonce and return the nonce', async () => {
      const dto: NonceRequestDto = { walletAddress: '0x1234567890123456789012345678901234567890' };
      const expectedNonce = 'random_nonce_value';

      jest.spyOn(authService, 'generateNonce').mockResolvedValue(expectedNonce);

      const result = await controller.generateNonce(dto);

      expect(authService.generateNonce).toHaveBeenCalledWith(dto.walletAddress);
      expect(result).toEqual({ nonce: expectedNonce });
    });

    it('should throw an exception if authService.generateNonce throws', async () => {
      const dto: NonceRequestDto = { walletAddress: '0x1234567890123456789012345678901234567890' };

      jest.spyOn(authService, 'generateNonce').mockRejectedValue(new InternalServerErrorException());

      await expect(controller.generateNonce(dto)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('walletLogin', () => {
    it('should call authService.verifySignatureAndLogin and return the accessToken', async () => {
      const dto: WalletLoginDto = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };
      const expectedResponse = { accessToken: 'jwt_token_string' };

      jest.spyOn(authService, 'verifySignatureAndLogin').mockResolvedValue(expectedResponse);

      const result = await controller.walletLogin(dto);

      expect(authService.verifySignatureAndLogin).toHaveBeenCalledWith(dto.walletAddress, dto.signature);
      expect(result).toEqual(expectedResponse);
    });

    it('should throw UnauthorizedException if authService throws UnauthorizedException', async () => {
      const dto: WalletLoginDto = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
      };

      jest.spyOn(authService, 'verifySignatureAndLogin').mockRejectedValue(new UnauthorizedException('Invalid signature'));

      await expect(controller.walletLogin(dto)).rejects.toThrow(UnauthorizedException);
    });
  });
});

