// src/common/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number = 50;

  @ApiPropertyOptional({ minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

export type PaginationQueryDto = PaginationDto;

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function buildPaginatedResponse<T>(
  items: T[],
  totalCount: number,
  page: number,
  pageSize: number,
): PaginatedResponse<T> {
  return {
    items,
    totalCount,
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 50,
    totalPages: Math.ceil(totalCount / (Number(pageSize) || 50)),
  };
}

export function getPaginationParams(dto: PaginationDto) {
  const page = Number(dto.page) || 1;
  const rawSize = dto.limit || dto.pageSize || 50;
  const pageSize = Math.min(Number(rawSize) || 50, 1000);
  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}
