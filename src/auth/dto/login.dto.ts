// src/auth/dto/login.dto.ts
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @ApiProperty({ example: 'bse.spr' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  password: string;
}