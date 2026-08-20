// src/reports/reports.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('incentive-register')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get incentive register report (paginated)' })
  async getIncentiveRegister(
    @Query() query: PaginationQueryDto & { year?: number; month?: number; partyType?: string; partCategoryCode?: string; status?: string },
  ) {
    return this.reportsService.getIncentiveRegister(query);
  }

  @Get('outstanding-master')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get party outstanding master report (paginated)' })
  async getOutstandingMaster(
    @Query() query: PaginationQueryDto & { year?: number; month?: number; partyType?: string; partCategoryCode?: string },
  ) {
    return this.reportsService.getOutstandingMaster(query);
  }

  @Get('performance')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get dealer sales performance report (paginated)' })
  async getPerformanceReport(
    @Query() query: PaginationQueryDto & { year?: number; month?: number; partCategoryCode?: string },
  ) {
    return this.reportsService.getPerformanceReport(query);
  }

  @Get('target-vs-achievement')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Get party-wise target vs achievement report (paginated)' })
  async getTargetVsAchievement(
    @Query() query: PaginationQueryDto & {
      fiscalYear?: number;
      month?: string;
      branchCode?: string;
      partyType?: string;
      partCategoryCode?: string;
      search?: string;
    },
  ) {
    return this.reportsService.getTargetVsAchievement(query);
  }

  @Post('target-vs-achievement/refresh')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Recalculate and refresh Target vs Achievement pre-aggregated cache' })
  async refreshTargetVsAchievement(
    @Body()
    body: {
      fiscalYear?: number;
      month?: string;
      lyWeight?: number;
      lmWeight?: number;
      lqWeight?: number;
      lfyWeight?: number;
      growthPercent?: number;
      floorMultiplier?: number;
    },
  ) {
    return this.reportsService.refreshTargetVsAchievementCache(
      Number(body?.fiscalYear) || 2026,
      body?.month || 'Aug',
      body,
    );
  }

  @Post('target-engine/lock')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Approve & Lock Target Matrix for a financial period' })
  async lockTargets(
    @Body() body: { fiscalYear: number; month: string },
    @Req() req: any,
  ) {
    return this.reportsService.lockTargets(
      Number(body.fiscalYear) || 2026,
      body.month || 'Aug',
      req.user?.username || req.user?.id || 'HO_ADMIN',
    );
  }

  @Post('target-engine/unlock')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Unlock Target Matrix to DRAFT state' })
  async unlockTargets(@Body() body: { fiscalYear: number; month: string }) {
    return this.reportsService.unlockTargets(
      Number(body.fiscalYear) || 2026,
      body.month || 'Aug',
    );
  }

  @Post('target-vs-achievement/update-target')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Update dealer admin defined target' })
  async updateDealerTarget(@Body() body: any, @Req() req: any) {
    return this.reportsService.updateDealerTarget({
      ...body,
      updatedBy: req.user?.username || req.user?.id,
    });
  }

  @Post('target-vs-achievement/bulk-target')
  @RequirePermissions('reports:view')
  @ApiOperation({ summary: 'Bulk adjust dealer targets' })
  async bulkAdjustTargets(@Body() body: any, @Req() req: any) {
    return this.reportsService.bulkAdjustTargets({
      ...body,
      updatedBy: req.user?.username || req.user?.id,
    });
  }

  @Get('export/excel')
  @RequirePermissions('reports:export')
  @ApiOperation({ summary: 'Export report data to Excel' })
  async exportExcel(
    @Query('type') type: string,
    @Query() query: any,
    @Res() res: Response,
  ) {
    let reportData: any = {};
    if (type === 'incentive-register') {
      reportData = await this.reportsService.getIncentiveRegister({ ...query, page: 1, pageSize: 5000 });
    } else if (type === 'outstanding-master') {
      reportData = await this.reportsService.getOutstandingMaster({ ...query, page: 1, pageSize: 5000 });
    } else if (type === 'performance') {
      reportData = await this.reportsService.getPerformanceReport({ ...query, page: 1, pageSize: 5000 });
    } else {
      reportData = await this.reportsService.getTargetVsAchievement({ ...query, page: 1, pageSize: 5000 });
    }

    const buffer = await this.reportsService.exportReportToExcel(type || 'target_vs_achievement', reportData.items || []);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type || 'target_vs_achievement'}.xlsx`);
    res.send(buffer);
  }
}
