// src/assets/assets.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssetsService } from './assets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  // ─── CATEGORY ENDPOINTS ───────────────────────────────────────────────────
  @Get('categories')
  @ApiOperation({ summary: 'List all dynamic asset categories' })
  async getCategories() {
    return this.assetsService.getCategories();
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create or update an asset category' })
  async createOrUpdateCategory(@Body() body: any) {
    return this.assetsService.createOrUpdateCategory(body);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete an asset category' })
  async deleteCategory(@Param('id') id: string) {
    return this.assetsService.deleteCategory(id);
  }

  // ─── ASSET ENDPOINTS ──────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'List all company assets with dynamic categories and filters' })
  async getAssets(
    @Query('category') category?: string,
    @Query('status') status?: string,
    @Query('branchCode') branchCode?: string,
    @Query('search') search?: string,
  ) {
    return this.assetsService.getAssets(category, status, branchCode, search);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset details with timeline and maintenance logs' })
  async getAssetById(@Param('id') id: string) {
    return this.assetsService.getAssetById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Register a new enterprise asset' })
  async createAsset(@Body() body: any, @Req() req: any) {
    return this.assetsService.createAsset(body, req.user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing asset' })
  async updateAsset(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.assetsService.updateAsset(id, body, req.user?.id);
  }

  @Post(':id/allocate')
  @ApiOperation({ summary: 'Allocate asset to a branch or user' })
  async allocateAsset(
    @Param('id') id: string,
    @Body() body: { branchCode?: string; userId?: string; userName?: string; remarks?: string },
    @Req() req: any,
  ) {
    return this.assetsService.allocateAsset(id, body, req.user?.id);
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return allocated asset back to available storage' })
  async returnAsset(
    @Param('id') id: string,
    @Body() body: { remarks?: string },
    @Req() req: any,
  ) {
    return this.assetsService.returnAsset(id, body?.remarks, req.user?.id);
  }

  @Post(':id/maintenance')
  @ApiOperation({ summary: 'Log maintenance/service on asset' })
  async logMaintenance(
    @Param('id') id: string,
    @Body() body: { type?: string; description: string; cost?: number; vendorName?: string; performedBy?: string },
    @Req() req: any,
  ) {
    return this.assetsService.logMaintenance(id, body, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete asset' })
  async deleteAsset(@Param('id') id: string, @Req() req: any) {
    return this.assetsService.deleteAsset(id, req.user?.id);
  }
}
