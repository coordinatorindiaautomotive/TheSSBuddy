// src/period-locks/period-locks.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PeriodLocksService } from './period-locks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PeriodModuleType } from '@prisma/client';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('period-locks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('period-locks')
export class PeriodLocksController {
  constructor(private readonly periodLocksService: PeriodLocksService) {}

  @Get()
  @RequirePermissions('period-locks:view')
  @ApiOperation({ summary: 'List period locks (paginated)' })
  async getPeriodLocks(
    @Query() query: PaginationQueryDto & { moduleType?: PeriodModuleType; year?: number; month?: number },
  ) {
    return this.periodLocksService.getPeriodLocks(query);
  }

  @Post('lock')
  @RequirePermissions('period-locks:lock')
  @ApiOperation({ summary: 'Lock a period' })
  async lockPeriod(
    @Body()
    body: {
      moduleType: PeriodModuleType;
      year: number;
      month: number;
      branchCode?: string;
      partCategoryCode?: string;
      incentiveSource?: string;
    },
    @Req() req: any,
  ) {
    return this.periodLocksService.lockPeriod(
      body.moduleType,
      body.year,
      body.month,
      body.branchCode || null,
      body.partCategoryCode,
      body.incentiveSource,
      req.user.id,
    );
  }

  @Post('unlock')
  @RequirePermissions('period-locks:unlock')
  @ApiOperation({ summary: 'Unlock a locked period with mandatory reason' })
  async unlockPeriod(
    @Body()
    body: {
      moduleType: PeriodModuleType;
      year: number;
      month: number;
      branchCode?: string;
      reason: string;
      remarks?: string;
    },
    @Req() req: any,
  ) {
    return this.periodLocksService.unlockPeriod(
      body.moduleType,
      body.year,
      body.month,
      body.branchCode || null,
      body.reason,
      body.remarks,
      req.user.id,
    );
  }

  @Post('close')
  @RequirePermissions('period-locks:close')
  @ApiOperation({ summary: 'Close a period permanently' })
  async closePeriod(
    @Body()
    body: {
      moduleType: PeriodModuleType;
      year: number;
      month: number;
      branchCode?: string;
    },
    @Req() req: any,
  ) {
    return this.periodLocksService.closePeriod(
      body.moduleType,
      body.year,
      body.month,
      body.branchCode || null,
      req.user.id,
    );
  }
}
