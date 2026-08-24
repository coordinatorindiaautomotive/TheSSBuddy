import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  IncentiveGovernorService,
  CalculateGovernorDto,
  CommitPeriodDto,
  ReopenPeriodDto,
} from './incentive-governor.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';

@Controller('incentive-governor')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncentiveGovernorController {
  constructor(
    private readonly incentiveGovernorService: IncentiveGovernorService
  ) {}

  @Get('masters')
  async getGovernorMasters() {
    return this.incentiveGovernorService.getGovernorMasters();
  }

  @Get('available-periods')
  async getAvailablePeriods() {
    return this.incentiveGovernorService.getAvailablePeriods();
  }

  @Get('period-status')
  async getPeriodStatus(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number
  ) {
    return this.incentiveGovernorService.getPeriodStatus(year, month);
  }

  @Post('calculate')
  async calculateDynamicIncentives(@Body() dto: CalculateGovernorDto) {
    return this.incentiveGovernorService.calculateDynamicIncentives(dto);
  }

  @Get('preview')
  async getPreviewRecords(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number
  ) {
    return this.incentiveGovernorService.getPreviewRecords(year, month);
  }

  @Post('commit')
  async commitIncentivePeriod(@Body() dto: CommitPeriodDto) {
    return this.incentiveGovernorService.commitIncentivePeriod(dto);
  }

  @Post('upload-precalculated')
  async uploadPrecalculatedIncentives(
    @Body('year', ParseIntPipe) year: number,
    @Body('month', ParseIntPipe) month: number,
    @Body('records') records: any[],
    @Body('uploadedBy') uploadedBy: string
  ) {
    return this.incentiveGovernorService.uploadPrecalculatedIncentives(
      year,
      month,
      records,
      uploadedBy || 'SuperAdmin'
    );
  }

  @Post('upload-bank-payout')
  @UseInterceptors(FileInterceptor('file'))
  async uploadBankPayoutExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('year', ParseIntPipe) year: number,
    @Body('month', ParseIntPipe) month: number,
    @Req() req: any
  ) {
    if (!file) {
      throw new BadRequestException('Excel file is required.');
    }
    const uploadedBy = req.user?.username || req.user?.fullName || 'SuperAdmin';
    return this.incentiveGovernorService.uploadBankPayoutExcel(
      file.buffer,
      year,
      month,
      file.originalname,
      uploadedBy
    );
  }

  @Post('reopen')
  async reopenPeriod(@Body() dto: ReopenPeriodDto) {
    return this.incentiveGovernorService.reopenPeriod(dto);
  }

  @Get('audit-trail')
  async getAuditTrail(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number
  ) {
    return this.incentiveGovernorService.getAuditTrail(year, month);
  }

  // Sync baseBranch in incentive register from Party Master baseLoc
  // POST /incentive-governor/sync-branch?partyCode=WRJ0105680  (single party)
  // POST /incentive-governor/sync-branch                        (all parties)
  @Post('sync-branch')
  async syncBranchFromPartyMaster(@Query('partyCode') partyCode?: string) {
    return this.incentiveGovernorService.syncBranchFromPartyMaster(partyCode);
  }
}
