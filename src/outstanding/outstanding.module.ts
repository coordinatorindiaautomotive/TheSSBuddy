// src/outstanding/outstanding.module.ts
import { Module } from '@nestjs/common';
import { OutstandingController } from './outstanding.controller';
import { OutstandingService } from './outstanding.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchIsolationModule } from '../branch-isolation/branch-isolation.module';

@Module({
  imports: [PrismaModule, AuditModule, BranchIsolationModule],
  controllers: [OutstandingController],
  providers: [OutstandingService],
  exports: [OutstandingService],
})
export class OutstandingModule {}
