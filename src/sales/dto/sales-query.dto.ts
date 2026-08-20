// src/sales/dto/sales-query.dto.ts
import { IsOptional, IsString, IsInt } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SalesQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  fiscalYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  month?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dealerCode?: string;
}
