import { Module } from '@nestjs/common';
import { IncentiveGovernorController } from './incentive-governor.controller';
import { IncentiveGovernorService } from './incentive-governor.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IncentiveGovernorController],
  providers: [IncentiveGovernorService],
  exports: [IncentiveGovernorService],
})
export class IncentiveGovernorModule {}
