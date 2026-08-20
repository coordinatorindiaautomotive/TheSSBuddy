// src/ledger/ledger.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('ledger')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('statement/:partyId')
  @RequirePermissions('ledger:view')
  @ApiOperation({ summary: 'Get party ledger statement view for a specific period' })
  async getPartyStatement(
    @Param('partyId') partyId: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const yr = Number(year) || new Date().getFullYear();
    const mo = Number(month) || (new Date().getMonth() + 1);
    return this.ledgerService.getPartyStatement(partyId, yr, mo);
  }

  @Post('snapshots')
  @RequirePermissions('ledger:snapshot')
  @ApiOperation({ summary: 'Create or update historical ledger snapshot for a party/period' })
  async createSnapshot(
    @Body() body: { partyId: string; year: number; month: number },
    @Req() req: any,
  ) {
    return this.ledgerService.createSnapshot(body.partyId, body.year, body.month, req.user.id);
  }

  @Post('compare')
  @RequirePermissions('ledger:view')
  @ApiOperation({ summary: 'Diff/compare two historical snapshots for a party' })
  async compareSnapshots(
    @Body()
    body: {
      partyId: string;
      period1: { year: number; month: number };
      period2: { year: number; month: number };
    },
  ) {
    return this.ledgerService.compareSnapshots(body.partyId, body.period1, body.period2);
  }

  @Get('export/excel/:partyId')
  @RequirePermissions('ledger:export')
  @ApiOperation({ summary: 'Export party ledger statement to Excel' })
  async exportLedger(
    @Param('partyId') partyId: string,
    @Query('year') year: number,
    @Query('month') month: number,
    @Res() res: Response,
  ) {
    const yr = Number(year) || new Date().getFullYear();
    const mo = Number(month) || (new Date().getMonth() + 1);
    const statement = await this.ledgerService.getPartyStatement(partyId, yr, mo);

    const buffer = await this.ledgerService.exportLedgerToExcel(statement);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ledger_${statement.party.code}_${yr}_${mo}.xlsx`);
    res.send(buffer);
  }
}
