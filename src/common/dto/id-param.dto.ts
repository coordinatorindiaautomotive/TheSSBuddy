// src/common/dto/id-param.dto.ts
import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UuidParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  id: string;
}