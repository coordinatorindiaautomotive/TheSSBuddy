// src/common/dto/export.dto.ts
import { IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ExportQueryDto {
  @ApiPropertyOptional({ enum: ['csv', 'xlsx'], default: 'xlsx' })
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: 'csv' | 'xlsx' = 'xlsx';
}
