// src/bullmq/bullmq.module.ts
import { Global, Module, Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

export const DASHBOARD_REFRESH_QUEUE = 'dashboard-refresh';
export const REPORT_GENERATION_QUEUE = 'report-generation';
export const BULK_MESSAGE_QUEUE = 'bulk-messaging';

const RECURRING_JOB_REGISTRY = new Map<string, string>();

export class MockQueue {
  constructor(public name: string) {}

  async add(name: string, data: any, opts?: any) {
    console.log(`[MockQueue ${this.name}] Added job: ${name}`, data);
    return { id: 'mock-job-id', name, data };
  }

  async getRepeatableJobs() {
    return [];
  }

  async removeRepeatableByKey(key: string) {
    return true;
  }

  async close() {
    return;
  }
}

@Injectable()
export class BullmqSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullmqSchedulerService.name);

  constructor(
    @Inject(DASHBOARD_REFRESH_QUEUE) private dashboardQueue: any,
    @Inject(REPORT_GENERATION_QUEUE) private reportQueue: any,
    @Inject(BULK_MESSAGE_QUEUE) private bulkMsgQueue: any,
  ) {}

  async onModuleInit() {
    await this.setupDashboardRefreshJob();
    await this.setupMonthlyReportJob();
    this.logger.log('BullMQ recurring jobs initialized (survive-restart safe)');
  }

  private async setupDashboardRefreshJob() {
    const jobKey = 'dashboard-aggregate-refresh';
    await this.removeExistingRepeatable(this.dashboardQueue, jobKey);

    await this.dashboardQueue.add(
      jobKey,
      { triggeredBy: 'scheduler' },
      {
        jobId: jobKey,
        repeat: {
          every: 5 * 60 * 1000,
        },
      },
    );
    RECURRING_JOB_REGISTRY.set(jobKey, DASHBOARD_REFRESH_QUEUE);
    this.logger.log(`Registered recurring job: ${jobKey} (every 5min)`);
  }

  private async setupMonthlyReportJob() {
    const jobKey = 'monthly-report-generation';
    await this.removeExistingRepeatable(this.reportQueue, jobKey);

    await this.reportQueue.add(
      jobKey,
      { triggeredBy: 'scheduler' },
      {
        jobId: jobKey,
        repeat: {
          pattern: '0 2 1 * *',
        },
      },
    );
    RECURRING_JOB_REGISTRY.set(jobKey, REPORT_GENERATION_QUEUE);
    this.logger.log(`Registered recurring job: ${jobKey} (monthly at 2AM)`);
  }

  private async removeExistingRepeatable(queue: any, jobKey: string) {
    try {
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const rj of repeatableJobs) {
        if (rj.key === jobKey || rj.name === jobKey) {
          await queue.removeRepeatableByKey(rj.key);
          this.logger.debug(`Removed existing repeatable job: ${rj.key}`);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Failed to clean up repeatable job ${jobKey}: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    await Promise.all([
      this.dashboardQueue.close(),
      this.reportQueue.close(),
      this.bulkMsgQueue.close(),
    ]);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DASHBOARD_REFRESH_QUEUE,
      useFactory: () => {
        if (process.env.USE_MOCK_REDIS === 'true') {
          return new MockQueue(DASHBOARD_REFRESH_QUEUE);
        }
        return new Queue(DASHBOARD_REFRESH_QUEUE, {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          defaultJobOptions: {
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 100 },
          },
        });
      },
    },
    {
      provide: REPORT_GENERATION_QUEUE,
      useFactory: () => {
        if (process.env.USE_MOCK_REDIS === 'true') {
          return new MockQueue(REPORT_GENERATION_QUEUE);
        }
        return new Queue(REPORT_GENERATION_QUEUE, {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          defaultJobOptions: {
            removeOnComplete: { count: 50 },
            removeOnFail: { count: 100 },
          },
        });
      },
    },
    {
      provide: BULK_MESSAGE_QUEUE,
      useFactory: () => {
        if (process.env.USE_MOCK_REDIS === 'true') {
          return new MockQueue(BULK_MESSAGE_QUEUE);
        }
        return new Queue(BULK_MESSAGE_QUEUE, {
          connection: {
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
          },
          defaultJobOptions: {
            removeOnComplete: { count: 100 },
            removeOnFail: { count: 200 },
          },
        });
      },
    },
    BullmqSchedulerService,
  ],
  exports: [DASHBOARD_REFRESH_QUEUE, REPORT_GENERATION_QUEUE, BULK_MESSAGE_QUEUE, BullmqSchedulerService],
})
export class BullmqModule {}