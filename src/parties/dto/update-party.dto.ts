// src/parties/dto/update-party.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreatePartyDto } from './create-party.dto';
import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePartyDto extends PartialType(CreatePartyDto) {
  @ApiPropertyOptional({ description: 'Optimistic concurrency control version' })
  @IsOptional()
  @IsNumber()
  rowVersion?: number;
}
