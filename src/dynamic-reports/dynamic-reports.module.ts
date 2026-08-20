// src/dynamic-reports/dynamic-reports.module.ts
import { Module } from '@nestjs/common';
import { DynamicReportsController } from './dynamic-reports.controller';
import { DynamicReportsService } from './dynamic-reports.service';

@Module({
  controllers: [DynamicReportsController],
  providers: [DynamicReportsService],
  exports: [DynamicReportsService],
})
export class DynamicReportsModule {}
