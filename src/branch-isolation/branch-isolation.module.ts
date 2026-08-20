// src/branch-isolation/branch-isolation.module.ts
import { Module, Global } from '@nestjs/common';
import { BranchIsolationService } from './branch-isolation.service';

@Global()
@Module({
  providers: [BranchIsolationService],
  exports: [BranchIsolationService],
})
export class BranchIsolationModule {}