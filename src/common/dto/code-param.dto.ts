// src/common/dto/code-param.dto.ts
import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CodeParamDto {
  @ApiProperty({ example: 'DELHI-01' })
  @IsString()
  @MaxLength(50)
  code: string;
}
