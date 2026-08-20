// src/control-tower/control-tower.module.ts
import { Module } from '@nestjs/common';
import { ControlTowerController } from './control-tower.controller';
import { ControlTowerService } from './control-tower.service';

@Module({
  controllers: [ControlTowerController],
  providers: [ControlTowerService],
  exports: [ControlTowerService],
})
export class ControlTowerModule {}
