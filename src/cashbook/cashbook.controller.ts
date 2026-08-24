// src/cashbook/cashbook.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashbookService } from './cashbook.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('cashbook')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cashbook')
export class CashbookController {
  constructor(private readonly cashbookService: CashbookService) {}

  @Get()
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get side-by-side Cashbook statement and transaction registers' })
  async getCashBook(
    @Query('branchCode') branchCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashbookService.getCashInList(undefined, branchCode, fromDate, toDate);
  }

  @Get('cash-in')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get CashIn transactions list' })
  async getCashInList(
    @Query('status') status?: string,
    @Query('branchCode') branchCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashbookService.getCashInList(status, branchCode, fromDate, toDate);
  }

  @Post('cash-in')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Create or update CashIn transaction' })
  async createCashIn(@Body() dto: any, @Req() req: any) {
    return this.cashbookService.createOrUpdateCashIn(dto, req.user?.id || 'system');
  }

  @Post('cash-in/:id/approve')
  @RequirePermissions('cashbook:approve')
  @ApiOperation({ summary: 'Approve or Reject CashIn transaction' })
  async approveCashIn(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('remarks') remarks?: string,
    @Req() req?: any,
  ) {
    return this.cashbookService.approveCashIn(id, status, remarks, req.user?.id || 'system');
  }

  @Get('cash-out')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get CashOut transactions list' })
  async getCashOutList(
    @Query('status') status?: string,
    @Query('branchCode') branchCode?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.cashbookService.getCashOutList(status, branchCode, fromDate, toDate);
  }

  @Post('cash-out')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Create or update CashOut transaction' })
  async createCashOut(@Body() dto: any, @Req() req: any) {
    return this.cashbookService.createOrUpdateCashOut(dto, req.user?.id || 'system');
  }

  @Post('cash-out/:id/approve')
  @RequirePermissions('cashbook:approve')
  @ApiOperation({ summary: 'Approve or Reject CashOut transaction' })
  async approveCashOut(
    @Param('id') id: string,
    @Body('status') status: string,
    @Body('remarks') remarks?: string,
    @Req() req?: any,
  ) {
    return this.cashbookService.approveCashOut(id, status, remarks, req.user?.id || 'system');
  }

  @Get('cost-center-cash')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get Cost Center Cash balances' })
  async getCostCenterCash(
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.cashbookService.getCostCenterCashList(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Post('cost-center-cash/sync')
  @RequirePermissions('cashbook:sync')
  @ApiOperation({ summary: 'Sync Cost Center Cash balances from Tally' })
  async syncCostCenterCash(
    @Body('year') year?: number,
    @Body('month') month?: number,
  ) {
    return this.cashbookService.syncCostCenterCash(
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  @Post('cash-out/batch')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Create multi-row CashOut payment batch' })
  async createCashOutBatch(@Body() dto: any, @Req() req: any) {
    return this.cashbookService.createCashOutBatch(dto, req.user?.id || 'system');
  }

  @Post('cash-in/batch')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Create multi-row CashIn receipt batch' })
  async createCashInBatch(@Body() dto: any, @Req() req: any) {
    return this.cashbookService.createCashInBatch(dto, req.user?.id || 'system');
  }

  // ─── CATEGORY & DROPDOWN MASTERS (Admin Configurable) ───────────────────
  @Get('categories')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get active category dropdown options' })
  async getCategories() {
    return this.cashbookService.getCategories();
  }

  @Get('categories/admin')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get all categories for Admin management' })
  async getAllCategoriesAdmin() {
    return this.cashbookService.getAllCategoriesAdmin();
  }

  @Post('categories')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Admin create a new category/dropdown option' })
  async createCategory(@Body() dto: any, @Req() req: any) {
    return this.cashbookService.createCategory(dto, req.user?.id || 'system');
  }

  @Put('categories/:id')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Admin update category/dropdown option' })
  async updateCategory(@Param('id') id: string, @Body() dto: any, @Req() req: any) {
    return this.cashbookService.updateCategory(id, dto, req.user?.id || 'system');
  }

  @Delete('categories/:id')
  @RequirePermissions('cashbook:create')
  @ApiOperation({ summary: 'Admin delete category/dropdown option' })
  async deleteCategory(@Param('id') id: string) {
    return this.cashbookService.deleteCategory(id);
  }

  @Get('period-controls')
  @RequirePermissions('cashbook:view')
  @ApiOperation({ summary: 'Get monthly period lock status controls' })
  async getPeriodControls() {
    return this.cashbookService.getPeriodControls();
  }

  @Post('period-controls')
  @RequirePermissions('cashbook:approve')
  @ApiOperation({ summary: 'Admin update monthly period lock status (Open/Closed/Locked)' })
  async updatePeriodControl(
    @Body('year') year: number,
    @Body('month') month: number,
    @Body('status') status: string,
    @Req() req?: any,
  ) {
    return this.cashbookService.updatePeriodControl(Number(year), Number(month), status, req.user?.id);
  }
}
