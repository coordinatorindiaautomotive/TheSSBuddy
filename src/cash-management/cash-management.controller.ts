// src/cash-management/cash-management.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CashManagementService } from './cash-management.service';
import { CreateCashTransactionDto, ReconcileCashTransactionDto } from './dto/cash-transaction.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('cash-management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('cash-management')
export class CashManagementController {
  constructor(private readonly cashManagementService: CashManagementService) {}

  @Post('transactions')
  @RequirePermissions('cash:create')
  @ApiOperation({ summary: 'Create a cash transaction (cash-in / cash-out)' })
  async createTransaction(
    @Body() dto: CreateCashTransactionDto,
    @Req() req: any,
  ) {
    return this.cashManagementService.createTransaction(dto, req.user.id);
  }

  @Post('transactions/:id/reconcile')
  @RequirePermissions('cash:reconcile')
  @ApiOperation({ summary: 'Reconcile a cash transaction against a bank staging record' })
  async reconcileTransaction(
    @Param('id') id: string,
    @Body() dto: ReconcileCashTransactionDto,
    @Req() req: any,
  ) {
    return this.cashManagementService.reconcile(id, dto.stagingRecordId, req.user.id);
  }

  @Get('transactions/unreconciled')
  @RequirePermissions('cash:view')
  @ApiOperation({ summary: 'List unreconciled cash transactions (paginated)' })
  async getUnreconciled(@Query() query: PaginationQueryDto & { transactionType?: string; costCenter?: string; dateFrom?: string; dateTo?: string }) {
    return this.cashManagementService.getUnreconciled(query);
  }

  @Post('period/close')
  @RequirePermissions('cash:close-period')
  @ApiOperation({ summary: 'Close cash period for a specific year, month, and branch' })
  async closeCashPeriod(
    @Body() body: { year: number; month: number; branchCode: string },
    @Req() req: any,
  ) {
    return this.cashManagementService.closeCashPeriod(
      body.year,
      body.month,
      body.branchCode,
      req.user.id,
    );
  }
}
