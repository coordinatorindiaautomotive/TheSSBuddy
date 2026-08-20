// src/dynamic-reports/dynamic-reports.controller.ts
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
import { DynamicReportsService } from './dynamic-reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('dynamic-reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dynamic-reports')
export class DynamicReportsController {
  constructor(private readonly service: DynamicReportsService) {}

  @Post('layouts')
  @RequirePermissions('dynamic-reports:create')
  @ApiOperation({ summary: 'Save custom report layout per user' })
  async createLayout(@Body() body: any, @Req() req: any) {
    return this.service.createLayout(body, req.user.id);
  }

  @Get('layouts')
  @RequirePermissions('dynamic-reports:view')
  @ApiOperation({ summary: 'List saved report layouts (user + public)' })
  async getLayouts(@Query() query: PaginationQueryDto, @Req() req: any) {
    return this.service.getLayouts(req.user.id, query);
  }

  @Get('layouts/:id')
  @RequirePermissions('dynamic-reports:view')
  @ApiOperation({ summary: 'Get report layout details by ID' })
  async getLayoutById(@Param('id') id: string) {
    return this.service.getLayoutById(id);
  }

  @Post('layouts/:id/execute')
  @RequirePermissions('dynamic-reports:execute')
  @ApiOperation({ summary: 'Execute a saved report layout dynamically' })
  async executeLayout(
    @Param('id') id: string,
    @Body() runtimeFilters: any,
  ) {
    return this.service.executeLayout(id, runtimeFilters || {});
  }
}
