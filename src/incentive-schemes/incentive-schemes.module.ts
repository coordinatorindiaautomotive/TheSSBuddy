// src/incentive-schemes/incentive-schemes.module.ts
import { Module } from '@nestjs/common';
import { IncentiveSchemesController } from './incentive-schemes.controller';
import { IncentiveSchemesService } from './incentive-schemes.service';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';

@Module({
  imports: [RuleEngineModule],
  controllers: [IncentiveSchemesController],
  providers: [IncentiveSchemesService],
  exports: [IncentiveSchemesService],
})
export class IncentiveSchemesModule {}