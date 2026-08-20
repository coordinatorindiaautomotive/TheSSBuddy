// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Connected to PostgreSQL via Prisma');

    // Log slow queries in development
    if (process.env.NODE_ENV === 'development') {
      // @ts-expect-error Prisma event typing
      this.$on('query', (e: { query: string; duration: number }) => {
        if (e.duration > 100) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query.substring(0, 200)}`);
        }
      });
    }

    // Enable row-level security awareness via middleware
    this.$use(this.softDeleteMiddleware);
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Disconnected from PostgreSQL');
  }

  /**
   * Middleware to convert deletions into updates setting isActive = false
   * for models that have an isActive field.
   */
  private softDeleteMiddleware = async (params: any, next: (params: any) => Promise<any>) => {
    const softDeleteModels = [
      'User', 'Branch', 'Party', 'PartyMapping', 'PartyBankDetail',
      'IncentiveScheme', 'RuleMaster', 'WorkflowDefinition',
      'MessageTemplate', 'Announcement', 'ImportTemplate', 'HelpText',
    ];

    if (params.action === 'delete' && softDeleteModels.includes(params.model)) {
      params.action = 'update';
      params.args.data = { ...params.args.data, isActive: false };
    }

    return next(params);
  };

  /**
   * Execute a callback within a transaction, returning the result.
   * Use for any multi-table financial write.
   */
  async executeInTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.$transaction(fn, {
      maxWait: 10000,
      timeout: 120000, // 2 minutes — enough for 80k+ row createMany batches
      isolationLevel: 'ReadCommitted',
    });
  }

  /**
   * Optimistic concurrency check — call before update to ensure row hasn't changed.
   * Throws if rowVersion doesn't match.
   */
  static checkRowVersion(expectedVersion: number, actualVersion: number | null | undefined) {
    if (actualVersion === null || actualVersion === undefined) {
      throw new Error('Record not found or version column missing');
    }
    if (actualVersion !== expectedVersion) {
      throw new Error(
        `Optimistic concurrency conflict: expected version ${expectedVersion}, found ${actualVersion}`,
      );
    }
  }
}