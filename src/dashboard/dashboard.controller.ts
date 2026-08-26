// src/dashboard/dashboard.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('executive-kpis')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get Power BI / DAX compliant FTD, MTD, QTD, YTD executive KPI cards' })
  async getExecutiveKPIs(
    @Query('fiscalYear') fiscalYear?: number,
    @Query('month') month?: string,
    @Query('day') day?: number,
    @Query('branchCode') branchCode?: string,
    @Query('partyType') partyType?: string,
    @Query('partCategory') partCategory?: string,
    @Query('refresh') refresh?: boolean | string,
  ) {
    return this.dashboardService.getExecutiveKPIs({
      fiscalYear: fiscalYear ? Number(fiscalYear) : undefined,
      month,
      day: day ? Number(day) : undefined,
      branchCode,
      partyType,
      partCategory,
      refresh: Boolean(refresh === true || refresh === 'true' || refresh === '1'),
    });
  }

  @Get('kpis')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get cached KPI summary cards for year/month/branch' })
  async getSummaryKPIs(
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('branchCode') branchCode?: string,
  ) {
    const yr = Number(year) || new Date().getFullYear();
    const mo = Number(month) || (new Date().getMonth() + 1);
    return this.dashboardService.getSummaryKPIs(yr, mo, branchCode);
  }

  @Get('trends')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get monthly performance trend charts' })
  async getTrends(
    @Query('year') year?: number,
    @Query('branchCode') branchCode?: string,
  ) {
    const yr = Number(year) || new Date().getFullYear();
    return this.dashboardService.getTrendCharts(yr, branchCode);
  }

  @Get('category-mix')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get part category sales mix break-up' })
  async getCategorySalesMix(
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('branchCode') branchCode?: string,
  ) {
    const yr = Number(year) || new Date().getFullYear();
    const mo = Number(month) || (new Date().getMonth() + 1);
    return this.dashboardService.getCategorySalesMix(yr, mo, branchCode);
  }

  @Get('alerts')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get operational alerts (overdue outstanding, dormant parties)' })
  async getAlerts(@Query('branchCode') branchCode?: string) {
    return this.dashboardService.getAlerts(branchCode);
  }

  @Get('raw-sales-analytics')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get rich analytics from raw_sales — KPIs, trends, branch/party/consignee breakdown' })
  async getRawSalesAnalytics(
    @Query('fiscalYear') fiscalYear?: number,
    @Query('month') month?: string,
    @Query('loc') loc?: string,
    @Query('partyType') partyType?: string,
    @Query('partCategory') partCategory?: string,
    @Query('consignee') consignee?: string,
    @Query('dealerSubType') dealerSubType?: string,
  ) {
    const yr = fiscalYear ? Number(fiscalYear) : undefined;
    return this.dashboardService.getRawSalesAnalytics({
      fiscalYear: yr,
      month,
      loc,
      partyType,
      partCategory,
      consignee,
      dealerSubType,
    });
  }

  @Get('dormant-parties')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get dormant parties' })
  async getDormantParties(@Query('days') days?: number) {
    return this.dashboardService.getDormantParties(days);
  }

  @Get('target-shortfalls')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get target shortfalls' })
  async getTargetShortfalls() {
    return this.dashboardService.getTargetShortfalls();
  }

  @Get('overdue-outstanding')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get overdue outstanding balance' })
  async getOverdueOutstanding() {
    return this.dashboardService.getOverdueOutstanding();
  }

  @Get('pending-mapping-reviews')
  @RequirePermissions('dashboard:view')
  @ApiOperation({ summary: 'Get pending mapping reviews' })
  async getPendingMappingReviews() {
    return this.dashboardService.getPendingMappingReviews();
  }
}
