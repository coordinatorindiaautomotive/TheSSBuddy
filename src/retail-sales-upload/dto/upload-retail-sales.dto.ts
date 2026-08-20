// src/retail-sales-upload/dto/upload-retail-sales.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RetailSalesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by month-year e.g. "Jun 2026"' })
  @IsOptional()
  @IsString()
  monthYear?: string;

  @ApiPropertyOptional({ description: 'Filter by dealer code' })
  @IsOptional()
  @IsString()
  dealerCode?: string;

  @ApiPropertyOptional({ description: 'Filter by consignee' })
  @IsOptional()
  @IsString()
  consignee?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  pageSize?: number;
}
