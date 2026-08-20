// src/dashboard/dashboard.module.ts
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { AnalyticsProcessor } from '../bullmq/analytics.processor';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, AnalyticsProcessor],
  exports: [DashboardService],
})
export class DashboardModule {}
