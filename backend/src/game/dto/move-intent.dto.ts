import { IsInt, IsNotEmpty, Min } from 'class-validator';

export class MoveIntentDto {
  @IsInt()
  @IsNotEmpty()
  @Min(0)
  hero_id: number;

  @IsInt()
  @IsNotEmpty()
  x: number;

  @IsInt()
  @IsNotEmpty()
  y: number;
}
