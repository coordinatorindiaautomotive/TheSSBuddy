// src/parties/parties.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PartiesService } from './parties.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PartyFilterDto } from './dto/party-filter.dto';
import { UuidParamDto } from '../common/dto/id-param.dto';

@ApiTags('parties')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('parties')
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Post()
  @RequirePermissions('party:create')
  @ApiOperation({ summary: 'Create a new party (dealer/customer)' })
  async create(@Body() dto: CreatePartyDto, @Req() req: any) {
    return this.partiesService.create(dto, req.user?.id);
  }

  @Get()
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'List parties with pagination and filters (branch-isolated)' })
  async findAll(@Query() filter: PartyFilterDto) {
    return this.partiesService.findAll(filter);
  }

  @Get('ssot-registry')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get Party Master SSOT Registry dynamically derived from raw_sales and bank master' })
  async getSsotRegistry(
    @Query('branchCode') branchCode?: string,
    @Req() req?: any,
  ) {
    const roleList = (req?.user?.roles || []).map((r: any) => (typeof r === 'string' ? r : r.name || '').toUpperCase());
    const isSuper = roleList.some((r: string) => r.includes('SUPER') || r.includes('ADMIN')) || 
                    req?.user?.username?.toLowerCase() === 'admin';

    // SuperAdmin: if specific branch requested filter by it, otherwise return full SSOT registry (all 3,195)
    if (isSuper) {
      if (branchCode && branchCode !== 'ALL' && branchCode !== 'All Branches') {
        return this.partiesService.getPartyMasterSsotRegistry(branchCode);
      }
      return this.partiesService.getPartyMasterSsotRegistry(undefined);
    }

    // Branch manager: restrict to their assigned branch
    const effectiveBranch = branchCode || req?.user?.branchCode || req?.branchContext?.defaultBranchCode;
    return this.partiesService.getPartyMasterSsotRegistry(effectiveBranch);
  }

  @Get('code/:code')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get party by code' })
  async findByCode(@Param('code') code: string) {
    return this.partiesService.findByCode(code);
  }

  @Get('mappings/all')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'List all party alternate code mappings' })
  async getAllMappings() {
    return this.partiesService.getAllPartyMappings();
  }

  @Get('bank-master/all')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get all bank master records' })
  async getBankMaster() {
    return this.partiesService.getBankMasterRecords();
  }

  // ── PARTY MASTER TABLE ─────────────────────────────────────────────────────

  @Post('party-master/sync')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('party:update')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sync party_master table from raw_sales (new codes added, base_loc & total_sales updated)' })
  async syncPartyMaster(@Req() req: any) {
    return this.partiesService.syncPartyMasterFromRawSales(req.user?.id);
  }

  @Patch('party-master/:code')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('party:update')
  @ApiOperation({ summary: 'Update manual fields on a party_master record (executive, bank, PAN, original_code, baseLoc, etc.)' })
  async patchPartyMaster(
    @Param('code') code: string,
    @Body() dto: {
      originalCode?:   string;
      baseLoc?:        string;
      salesExecutive?: string;
      phone?:          string;
      pan?:            string;
      gstIn?:          string;
      bankName?:       string;
      bankBranch?:     string;
      accountNumber?:  string;
      ifscCode?:       string;
      accountHolder?:  string;
      incentiveType?:  string;
      incentiveRule?:  string;
      isActive?:       boolean;
    },
    @Req() req: any,
  ) {
    return this.partiesService.updatePartyMasterRecord(code, {
      ...dto,
      updatedBy: req.user?.id,
      updatedByUsername: req.user?.username,
      updaterRoles: req.user?.roles || [],
    });
  }

  @Get('ifsc/:ifscCode')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Lookup bank name and branch name by IFSC code' })
  async lookupIfsc(@Param('ifscCode') ifscCode: string) {
    return this.partiesService.lookupIfsc(ifscCode);
  }

  @Get(':id')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get party by ID with full details' })
  async findOne(@Param() params: UuidParamDto) {
    return this.partiesService.findOne(params.id);
  }

  @Put(':id')
  @RequirePermissions('party:update')
  @ApiOperation({ summary: 'Update party (optimistic concurrency via rowVersion)' })
  async update(
    @Param() params: UuidParamDto,
    @Body() dto: UpdatePartyDto,
    @Req() req: any,
  ) {
    return this.partiesService.update(params.id, dto, req.user.id);
  }

  @Get(':id/mappings')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get party mappings' })
  async getMappings(
    @Param() params: UuidParamDto,
    @Query('type') mappingType?: string,
  ) {
    return this.partiesService.getMappings(params.id, mappingType);
  }

  @Post(':id/mappings')
  @RequirePermissions('party:update')
  @ApiOperation({ summary: 'Add a party mapping' })
  async addMapping(
    @Param() params: UuidParamDto,
    @Body() body: { mappingType: string; mappedValue: string; mappedLabel?: string },
    @Req() req: any,
  ) {
    return this.partiesService.addMapping(
      params.id,
      body.mappingType,
      body.mappedValue,
      body.mappedLabel,
      req.user.id,
    );
  }

  @Post('mappings/batch')
  @RequirePermissions('party:update')
  @ApiOperation({ summary: 'Batch import alternate code to original code mappings' })
  async batchImportMappings(@Body() body: { items: Array<{ alternateCode: string; originalCode: string; partyName?: string; branchCode?: string }> }, @Req() req: any) {
    return this.partiesService.batchImportPartyMappings(body.items || [], req.user?.id);
  }

  @Get(':id/summary')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get party summary for dashboard simulator' })
  async getSummary(@Param() params: UuidParamDto) {
    return this.partiesService.getPartySummary(params.id);
  }

  @Get(':id/history')
  @RequirePermissions('party:read')
  @ApiOperation({ summary: 'Get party history for dashboard timeline/lifecycle' })
  async getHistory(@Param() params: UuidParamDto) {
    return this.partiesService.getPartyHistory(params.id);
  }

  @Post('bank-master/upsert')
  @RequirePermissions('party:update')
  @ApiOperation({ summary: 'Add or update party bank master details' })
  async upsertBankMaster(
    @Body()
    body: {
      partyCode: string;
      accountNumber: string;
      accountHolder?: string;
      ifscCode?: string;
      bankName: string;
      branchName?: string;
      pan?: string;
      mobile?: string;
    },
    @Req() req: any,
  ) {
    return this.partiesService.upsertBankMasterRecord(body, req.user?.id);
  }

}