// src/control-tower/control-tower.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ControlTowerService } from './control-tower.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('control-tower')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('control-tower')
export class ControlTowerController {
  constructor(private readonly controlTowerService: ControlTowerService) {}

  @Get('operational')
  @RequirePermissions('control-tower:view')
  @ApiOperation({ summary: 'Cross-module operational control tower dashboard spanning branches' })
  async getOperationalControlTower(
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.controlTowerService.getOperationalControlTower(year, month);
  }

  @Get('customer-360/:partyIdOrCode')
  @RequirePermissions('control-tower:customer-360')
  @ApiOperation({ summary: 'Single per-party 360-degree aggregated operational view' })
  async getCustomer360(@Param('partyIdOrCode') partyIdOrCode: string) {
    return this.controlTowerService.getCustomer360(partyIdOrCode);
  }
}
