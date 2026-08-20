// src/parties/dto/create-party.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartyType, PartySubType, MappingType } from '@prisma/client';

export class PartyBankDetailDto {
  @ApiProperty()
  @IsString()
  bankName: string;

  @ApiProperty()
  @IsString()
  branchName: string;

  @ApiProperty()
  @IsString()
  accountNumber: string;

  @ApiProperty()
  @IsString()
  ifscCode: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountHolder?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class PartyMappingDto {
  @ApiProperty({ enum: MappingType })
  @IsEnum(MappingType)
  mappingType: MappingType;

  @ApiProperty()
  @IsString()
  mappedValue: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mappedLabel?: string;
}

export class CreatePartyDto {
  @ApiProperty()
  @IsString()
  @MaxLength(50)
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ enum: PartyType })
  @IsEnum(PartyType)
  type: PartyType;

  @ApiPropertyOptional({ enum: PartySubType, default: 'REGULAR' })
  @IsOptional()
  @IsEnum(PartySubType)
  subType?: PartySubType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  primaryBranchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gstIn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPerson?: string;

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
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ type: [PartyBankDetailDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyBankDetailDto)
  bankDetails?: PartyBankDetailDto[];

  @ApiPropertyOptional({ type: [PartyMappingDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartyMappingDto)
  mappings?: PartyMappingDto[];
}