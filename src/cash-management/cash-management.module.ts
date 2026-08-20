// src/cash-management/cash-management.module.ts
import { Module } from '@nestjs/common';
import { CashManagementController } from './cash-management.controller';
import { CashManagementService } from './cash-management.service';

@Module({
  controllers: [CashManagementController],
  providers: [CashManagementService],
  exports: [CashManagementService],
})
export class CashManagementModule {}