// src/branches/dto/create-branch.dto.ts
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBranchDto {
  @ApiProperty()
  @IsString()
  @MaxLength(20)
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  region?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consignee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  incharge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coordinates?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  latitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  longitude?: string;

  @ApiPropertyOptional()
  @IsOptional()
  openingDate?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allowedCategories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  allowedPartyTypes?: string;
}