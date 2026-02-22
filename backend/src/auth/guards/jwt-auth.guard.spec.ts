import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (headers: any = {}): ExecutionContext => {
    const request = { headers };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if token is valid and inject payload', async () => {
    const payload = { sub: 1, walletAddress: '0x123' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({ authorization: 'Bearer valid-token' });
    const request = context.switchToHttp().getRequest();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    expect((request as any).user).toEqual(payload);
  });

  it('should throw UnauthorizedException if token is missing', async () => {
    const context = createMockContext(); // No headers

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token is missing');
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if auth header format is wrong', async () => {
     const context = createMockContext({ authorization: 'Basic valid-token' }); // Not Bearer

     await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
     await expect(guard.canActivate(context)).rejects.toThrow('Token is missing');
     expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if token verification fails', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

    const context = createMockContext({ authorization: 'Bearer invalid-token' });
    const request = context.switchToHttp().getRequest();

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token is invalid or expired');
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('invalid-token', { secret: 'test-secret' });
    expect((request as any).user).toBeUndefined();
  });
});
