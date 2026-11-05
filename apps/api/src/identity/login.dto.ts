import { Transform } from 'class-transformer';
import {
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeUsername(value) : value,
  )
  @IsString()
  @Length(3, 64)
  @Matches(/^[a-z0-9][a-z0-9._-]{2,63}$/)
  username: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;
}
