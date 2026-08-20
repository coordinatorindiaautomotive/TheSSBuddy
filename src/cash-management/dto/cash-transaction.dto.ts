// src/cash-management/dto/cash-transaction.dto.ts
import { IsEnum, IsString, IsNumber, IsOptional, IsDateString, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CashTransactionType } from '@prisma/client';

export class CreateCashTransactionDto {
  @ApiProperty({ enum: CashTransactionType, example: 'CASH_IN' })
  @IsEnum(CashTransactionType)
  transactionType: CashTransactionType;

  @ApiProperty({ example: 'DELHI-01' })
  @IsString()
  branchCode: string;

  @ApiPropertyOptional({ example: '8f9e6b40-2051-4e4f-b1e1-88f1107a4a21' })
  @IsOptional()
  @IsUUID()
  partyId?: string;

  @ApiPropertyOptional({ example: 'CC-NORTH-01' })
  @IsOptional()
  @IsString()
  costCenter?: string;

  @ApiProperty({ example: 15000.50 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ example: '2026-07-20T10:00:00Z' })
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional({ example: 'REF-88492' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ example: 'Cash payment received for Invoice #1049' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class ReconcileCashTransactionDto {
  @ApiProperty({ example: 'f3a41c10-90df-4d51-a201-9011885b1a20' })
  @IsUUID()
  stagingRecordId: string;
}
