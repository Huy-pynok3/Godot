export class HeroMoveConfirmedDto {
  tokenId: number;
  position: {
    x: number;
    y: number;
  };
  timestamp: number;
}
