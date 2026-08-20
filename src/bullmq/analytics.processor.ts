// src/bullmq/analytics.processor.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Worker } from 'bullmq';
import { DASHBOARD_REFRESH_QUEUE } from './bullmq.module';
import { DashboardService } from '../dashboard/dashboard.service';

@Injectable()
export class AnalyticsProcessor implements OnModuleInit {
  private readonly logger = new Logger(AnalyticsProcessor.name);
  private worker: any;

  constructor(private readonly dashboardService: DashboardService) {}

  onModuleInit() {
    if (process.env.USE_MOCK_REDIS === 'true') {
      this.logger.log('Bypassing BullMQ worker instantiation in mock mode');
      return;
    }

    this.worker = new Worker(
      DASHBOARD_REFRESH_QUEUE,
      async (job) => {
        this.logger.log(`Processing background job: ${job.name} (ID: ${job.id})`);
        if (job.name === 'dashboard-aggregate-refresh') {
          await this.dashboardService.precomputeAggregates();
        }
      },
      {
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
        },
      },
    );

    this.worker.on('completed', (job: any) => {
      this.logger.log(`Job ${job.name} completed successfully`);
    });

    this.worker.on('failed', (job: any, err: any) => {
      this.logger.error(`Job ${job?.name} failed: ${err.message}`, err.stack);
    });
  }
}
