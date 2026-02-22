import { WsJwtGuard } from './ws-jwt.guard';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Test, TestingModule } from '@nestjs/testing';

describe('WsJwtGuard', () => {
  let guard: WsJwtGuard;
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
        WsJwtGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<WsJwtGuard>(WsJwtGuard);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (handshake: any = {}): ExecutionContext => {
    const client = { handshake };
    return {
      switchToWs: () => ({
        getClient: () => client,
      }),
    } as unknown as ExecutionContext;
  };

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if token is valid in auth payload and inject payload', async () => {
    const payload = { sub: 1, walletAddress: '0x123' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({ auth: { token: 'valid-token' } });
    const client = context.switchToWs().getClient();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    expect((client as any).user).toEqual(payload);
  });

  it('should return true if token is valid in query params and inject payload', async () => {
    const payload = { sub: 1, walletAddress: '0x123' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({ query: { token: 'valid-token' } });
    const client = context.switchToWs().getClient();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    expect((client as any).user).toEqual(payload);
  });

   it('should return true if token is valid in headers and inject payload', async () => {
    const payload = { sub: 1, walletAddress: '0x123' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const context = createMockContext({ headers: { authorization: 'Bearer valid-token' } });
    const client = context.switchToWs().getClient();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', { secret: 'test-secret' });
    expect((client as any).user).toEqual(payload);
  });

  it('should throw WsException if token is missing', async () => {
    const context = createMockContext(); // No handshake data

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
    await expect(guard.canActivate(context)).rejects.toThrow('Unauthorized: Token is missing');
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw WsException if auth header format is wrong', async () => {
     const context = createMockContext({ headers: { authorization: 'Basic valid-token' } }); // Not Bearer

     await expect(guard.canActivate(context)).rejects.toThrow(WsException);
     await expect(guard.canActivate(context)).rejects.toThrow('Unauthorized: Token is missing');
     expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw WsException if token verification fails', async () => {
    mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

    const context = createMockContext({ auth: { token: 'invalid-token' } });
    const client = context.switchToWs().getClient();

    await expect(guard.canActivate(context)).rejects.toThrow(WsException);
    await expect(guard.canActivate(context)).rejects.toThrow('Unauthorized: Token is invalid or expired');
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('invalid-token', { secret: 'test-secret' });
    expect(client.user).toBeUndefined();
  });
});
