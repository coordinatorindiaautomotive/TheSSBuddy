// src/bank-imports/bank-imports.module.ts
import { Module } from '@nestjs/common';
import { BankImportsController } from './bank-imports.controller';
import { BankImportsService } from './bank-imports.service';
import { DataImportsModule } from '../data-imports/data-imports.module';

@Module({
  imports: [DataImportsModule],
  controllers: [BankImportsController],
  providers: [BankImportsService],
  exports: [BankImportsService],
})
export class BankImportsModule {}