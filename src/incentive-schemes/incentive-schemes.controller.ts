// src/incentive-schemes/incentive-schemes.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { IncentiveSchemesService } from './incentive-schemes.service';
import { UuidParamDto } from '../common/dto/id-param.dto';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('incentive-schemes')
@ApiBearerAuth()
@Controller('incentive-schemes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncentiveSchemesController {
  constructor(private readonly service: IncentiveSchemesService) {}

  @Post()
  @RequirePermissions('incentive-scheme:create')
  @ApiOperation({ summary: 'Create incentive scheme with slab details' })
  async create(@Body() body: any, @Req() req: any) {
    return this.service.createScheme(body, req.user.id);
  }

  @Get()
  @RequirePermissions('incentive-scheme:read')
  @ApiOperation({ summary: 'List incentive schemes' })
  async findAll(@Query() query: PaginationQueryDto & { isActive?: boolean; source?: string }) {
    return this.service.getSchemes(query);
  }

  @Get('records')
  @RequirePermissions('incentive:read')
  @ApiOperation({ summary: 'List calculated/uploaded incentive records (paginated)' })
  async getIncentiveRecords(
    @Query() query: PaginationQueryDto & { year?: number; month?: number; partyId?: string; status?: string; recordType?: string },
  ) {
    return this.service.getIncentiveRecords(query);
  }

  @Get(':id')
  @RequirePermissions('incentive-scheme:read')
  @ApiOperation({ summary: 'Get incentive scheme details by ID' })
  async findOne(@Param() params: UuidParamDto) {
    return this.service.getSchemeById(params.id);
  }

  @Put(':id')
  @RequirePermissions('incentive-scheme:update')
  @ApiOperation({ summary: 'Update incentive scheme with slab details' })
  async update(@Param() params: UuidParamDto, @Body() body: any, @Req() req: any) {
    return this.service.updateScheme(params.id, body, req.user.id);
  }

  @Delete(':id')
  @RequirePermissions('incentive-scheme:delete')
  @ApiOperation({ summary: 'Deactivate/Delete incentive scheme' })
  async remove(@Param() params: UuidParamDto, @Req() req: any) {
    return this.service.deleteScheme(params.id, req.user.id);
  }

  @Post('calculate')
  @RequirePermissions('incentive:calculate')
  @ApiOperation({ summary: 'Calculate incentive for a party/period' })
  async calculate(@Body() body: any, @Req() req: any) {
    return this.service.calculateIncentive(
      body.partyId,
      body.year,
      body.month,
      body.branchCode,
      body.partCategoryCode || null,
      body.baseAmount,
      req.user.id,
    );
  }

  @Put('records/:id/override')
  @RequirePermissions('incentive:override')
  @ApiOperation({ summary: 'Override calculated incentive (mandatory remarks)' })
  async override(
    @Param() params: UuidParamDto,
    @Body() body: { newAmount: number; remarks: string; rowVersion: number },
    @Req() req: any,
  ) {
    return this.service.overrideIncentive(
      params.id,
      body.newAmount,
      body.remarks,
      req.user.id,
      body.rowVersion,
    );
  }

  @Get('governor/options')
  @RequirePermissions('incentive:read')
  @ApiOperation({ summary: 'Get dynamic branches, categories, and party types for governor console' })
  async getGovernorOptions(@Query('year') year?: number, @Query('month') month?: string) {
    return this.service.getGovernorOptions(year ? Number(year) : undefined, month);
  }

  @Post('governor/run')
  @RequirePermissions('incentive:calculate')
  @ApiOperation({ summary: 'Run Incentive Governor engine calculation for month/year' })
  async runGovernor(@Body() body: { year: number; month: number; branchCode?: string }, @Req() req: any) {
    return this.service.runGovernorCalculation(Number(body.year), Number(body.month), body.branchCode, req.user?.id);
  }

  @Post('governor/preview')
  @RequirePermissions('incentive:calculate')
  @ApiOperation({ summary: 'Run calculation preview with governance filters' })
  async runPreview(@Body() body: { year: number; month: number; branchScopeConfig?: any }, @Req() req: any) {
    return this.service.runGovernorPreview(Number(body.year), Number(body.month), body.branchScopeConfig, req.user?.id);
  }

  @Post('governor/upload-precalculated')
  @RequirePermissions('incentive:calculate')
  @ApiOperation({ summary: 'Upload custom pre-calculated Excel rows' })
  async uploadPrecalculated(@Body() body: { year: number; month: number; rows: any[] }, @Req() req: any) {
    return this.service.uploadPrecalculatedIncentives(Number(body.year), Number(body.month), body.rows || [], req.user?.id);
  }

  @Post('governor/push-to-register')
  @RequirePermissions('incentive:calculate')
  @ApiOperation({ summary: 'Push preview calculations to master incentive register' })
  async pushToRegister(@Body() body: { year: number; month: number; rows: any[] }, @Req() req: any) {
    return this.service.pushPreviewToLedgers(Number(body.year), Number(body.month), body.rows || [], req.user?.id);
  }

  @Post('records/verify')
  @RequirePermissions('incentive:approve')
  @ApiOperation({ summary: 'Verify draft incentive records' })
  async verifyRecords(@Body() body: { ids: string[] }, @Req() req: any) {
    return this.service.verifyRecords(body.ids, req.user?.id);
  }

  @Post('records/reject')
  @RequirePermissions('incentive:approve')
  @ApiOperation({ summary: 'Reject incentive records with remarks' })
  async rejectRecords(@Body() body: { ids: string[]; remarks: string }, @Req() req: any) {
    return this.service.rejectRecords(body.ids, body.remarks, req.user?.id);
  }

  @Post('records/post')
  @RequirePermissions('incentive:post')
  @ApiOperation({ summary: 'Post verified incentive records to final register & lock period' })
  async postRecords(@Body() body: { ids: string[] }, @Req() req: any) {
    return this.service.postRecords(body.ids, req.user?.id);
  }

  @Get('records/:id/transactions')
  @RequirePermissions('incentive:read')
  @ApiOperation({ summary: 'Get underlying line-by-line raw sales transactions for drilldown' })
  async getSourceTransactions(@Param('id') id: string) {
    return this.service.getSourceTransactions(id);
  }
}