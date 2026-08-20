// src/helpdesk/helpdesk.module.ts
import { Module } from '@nestjs/common';
import { HelpdeskService } from './helpdesk.service';
import { HelpdeskController } from './helpdesk.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchIsolationModule } from '../branch-isolation/branch-isolation.module';

@Module({
  imports: [PrismaModule, AuditModule, BranchIsolationModule],
  controllers: [HelpdeskController],
  providers: [HelpdeskService],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
