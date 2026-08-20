// src/assets/assets.module.ts
import { Module } from '@nestjs/common';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BranchIsolationModule } from '../branch-isolation/branch-isolation.module';

@Module({
  imports: [PrismaModule, AuditModule, BranchIsolationModule],
  controllers: [AssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
