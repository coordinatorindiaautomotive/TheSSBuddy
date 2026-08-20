// src/ai-query/ai-query.module.ts
import { Module } from '@nestjs/common';
import { AiQueryController } from './ai-query.controller';
import { AiQueryService } from './ai-query.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ReportsModule } from '../reports/reports.module';
import { ControlTowerModule } from '../control-tower/control-tower.module';

@Module({
  imports: [DashboardModule, ReportsModule, ControlTowerModule],
  controllers: [AiQueryController],
  providers: [AiQueryService],
  exports: [AiQueryService],
})
export class AiQueryModule {}
