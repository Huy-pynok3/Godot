export class StartSessionResponseDto {
  sessionId: string;
  status: string;
  gridData: Array<{ x: number; y: number; hp: number }>;
  gridSize: { width: number; height: number };
  chestCount: number;
}
