// src/cashbook/cashbook.module.ts
import { Module } from '@nestjs/common';
import { CashbookService } from './cashbook.service';
import { CashbookController } from './cashbook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchIsolationModule } from '../branch-isolation/branch-isolation.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, AuditModule, BranchIsolationModule, ConfigModule],
  controllers: [CashbookController],
  providers: [CashbookService],
  exports: [CashbookService],
})
export class CashbookModule {}
