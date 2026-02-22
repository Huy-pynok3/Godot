import { validate } from 'class-validator';
import { BombIntentDto } from './bomb-intent.dto';

describe('BombIntentDto', () => {
  it('should validate with valid data', async () => {
    const dto = new BombIntentDto();
    dto.hero_id = 1;
    dto.x = 5;
    dto.y = 10;
    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail validation with invalid hero_id', async () => {
    const dto = new BombIntentDto();
    dto.hero_id = '1' as any; // Invalid type
    dto.x = 5;
    dto.y = 10;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('hero_id');
  });

  it('should fail validation with negative hero_id', async () => {
    const dto = new BombIntentDto();
    dto.hero_id = -1;
    dto.x = 5;
    dto.y = 10;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('hero_id');
    expect(errors[0].constraints?.min).toBeDefined();
  });

  it('should fail validation with invalid x or y', async () => {
    const dto = new BombIntentDto();
    dto.hero_id = 1;
    dto.x = '5' as any; // Invalid type
    dto.y = 10;
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('x');
  });

  it('should fail validation when fields are missing', async () => {
    const dto = new BombIntentDto();
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['hero_id', 'x', 'y']));
  });
});
