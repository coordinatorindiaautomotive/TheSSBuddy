// src/users/dto/grant-branch-access.dto.ts
import { IsArray, IsString, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GrantBranchAccessDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  branchCodes: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}
