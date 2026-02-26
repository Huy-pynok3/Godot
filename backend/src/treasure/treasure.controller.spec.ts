import { Test, TestingModule } from '@nestjs/testing';
import { TreasureController } from './treasure.controller';
import { TreasureService } from './treasure.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('TreasureController', () => {
  let controller: TreasureController;
  let service: TreasureService;

  const mockTreasureService = {
    startSession: jest.fn(),
    stopSession: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TreasureController],
      providers: [
        {
          provide: TreasureService,
          useValue: mockTreasureService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TreasureController>(TreasureController);
    service = module.get<TreasureService>(TreasureService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('startSession', () => {
    it('should call service.startSession with user ID from JWT', async () => {
      const mockRequest = { user: { id: 'user-123' } };
      const mockResponse = {
        sessionId: 'session-1',
        status: 'ACTIVE',
        gridData: [],
        gridSize: { width: 20, height: 15 },
        chestCount: 40,
      };

      mockTreasureService.startSession.mockResolvedValue(mockResponse);

      const result = await controller.startSession(mockRequest);

      expect(service.startSession).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockResponse);
    });
  });

  describe('stopSession', () => {
    it('should call service.stopSession with user ID from JWT', async () => {
      const mockRequest = { user: { id: 'user-123' } };
      const mockResponse = {
        sessionId: 'session-1',
        status: 'COMPLETED',
        message: 'Session stopped successfully',
      };

      mockTreasureService.stopSession.mockResolvedValue(mockResponse);

      const result = await controller.stopSession(mockRequest);

      expect(service.stopSession).toHaveBeenCalledWith('user-123');
      expect(result).toEqual(mockResponse);
    });
  });
});
