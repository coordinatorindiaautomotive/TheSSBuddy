// src/users/dto/create-user.dto.ts
import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  IsArray,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  fullName: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [String], description: 'Role IDs to assign' })
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds: string[];

  @ApiProperty({ type: [String], description: 'Branch codes to grant access' })
  @IsArray()
  @IsString({ each: true })
  branchCodes: string[];
}