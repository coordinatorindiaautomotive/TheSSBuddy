import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { BullmqModule } from './bullmq/bullmq.module';
import { AuditModule } from './audit/audit.module';
import { BranchIsolationModule } from './branch-isolation/branch-isolation.module';
import { RbacModule } from './rbac/rbac.module';
import { CacheModule } from './cache/cache.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { BranchesModule } from './branches/branches.module';
import { PartiesModule } from './parties/parties.module';
import { PeriodLocksModule } from './period-locks/period-locks.module';
import { IncentiveSchemesModule } from './incentive-schemes/incentive-schemes.module';
import { CashManagementModule } from './cash-management/cash-management.module';
import { BankImportsModule } from './bank-imports/bank-imports.module';
import { ExternalIncentiveUploadsModule } from './external-incentive-uploads/external-incentive-uploads.module';
import { RuleEngineModule } from './rule-engine/rule-engine.module';
import { WorkflowModule } from './workflow/workflow.module';
import { ReportsModule } from './reports/reports.module';
import { DynamicReportsModule } from './dynamic-reports/dynamic-reports.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { LedgerModule } from './ledger/ledger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DataImportsModule } from './data-imports/data-imports.module';
import { ControlTowerModule } from './control-tower/control-tower.module';
import { AiQueryModule } from './ai-query/ai-query.module';
import { ProfileModule } from './profile/profile.module';
import { SalesModule } from './sales/sales.module';
import { OutstandingModule } from './outstanding/outstanding.module';
import { CashbookModule } from './cashbook/cashbook.module';
import { AssetsModule } from './assets/assets.module';
import { HelpdeskModule } from './helpdesk/helpdesk.module';
import { RetailSalesUploadModule } from './retail-sales-upload/retail-sales-upload.module';
import { IncentiveGovernorModule } from './incentive-governor/incentive-governor.module';

@Module({
  imports: [
    // Config must be first
    ConfigModule.forRoot({ isGlobal: true }),
    // Throttler for rate limiting
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    // Infrastructure
    PrismaModule,
    RedisModule,
    BullmqModule,
    // Cross-cutting concerns
    AuditModule,
    BranchIsolationModule,
    RbacModule,
    CacheModule,
    PeriodLocksModule,
    // Business modules
    AuthModule,
    UsersModule,
    BranchesModule,
    PartiesModule,
    IncentiveSchemesModule,
    IncentiveGovernorModule,
    CashManagementModule,
    BankImportsModule,
    ExternalIncentiveUploadsModule,
    RuleEngineModule,
    WorkflowModule,
    ReportsModule,
    DynamicReportsModule,
    DashboardModule,
    LedgerModule,
    NotificationsModule,
    DataImportsModule,
    ControlTowerModule,
    AiQueryModule,
    ProfileModule,
    SalesModule,
    OutstandingModule,
    CashbookModule,
    AssetsModule,
    HelpdeskModule,
    RetailSalesUploadModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}