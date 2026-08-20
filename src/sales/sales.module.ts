// src/sales/sales.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BranchIsolationModule } from '../branch-isolation/branch-isolation.module';
import { AuditModule } from '../audit/audit.module';
import { PeriodLocksModule } from '../period-locks/period-locks.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [
    PrismaModule,
    BranchIsolationModule,
    AuditModule,
    PeriodLocksModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
