// src/period-locks/period-locks.module.ts
import { Module, Global } from '@nestjs/common';
import { PeriodLocksController } from './period-locks.controller';
import { PeriodLocksService } from './period-locks.service';

@Global()
@Module({
  controllers: [PeriodLocksController],
  providers: [PeriodLocksService],
  exports: [PeriodLocksService],
})
export class PeriodLocksModule {}
