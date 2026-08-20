// src/parties/dto/party-filter.dto.ts
import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PartyType, PartySubType } from '@prisma/client';

export class PartyFilterDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: PartyType })
  @IsOptional()
  @IsEnum(PartyType)
  type?: PartyType;

  @ApiPropertyOptional({ enum: PartySubType })
  @IsOptional()
  @IsEnum(PartySubType)
  subType?: PartySubType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  executiveCode?: string;
}
