// src/data-imports/data-imports.controller.ts
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
import { DataImportsService } from './data-imports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('data-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('data-imports')
export class DataImportsController {
  constructor(private readonly dataImportsService: DataImportsService) {}

  @Post('templates')
  @RequirePermissions('data-imports:create-template')
  @ApiOperation({ summary: 'Create import column mapping template' })
  async createTemplate(@Body() body: any, @Req() req: any) {
    return this.dataImportsService.createTemplate(body, req.user.id);
  }

  @Get('templates')
  @RequirePermissions('data-imports:view')
  @ApiOperation({ summary: 'List import templates' })
  async getTemplates(@Query() query: PaginationQueryDto & { sourceType?: string; isActive?: boolean }) {
    return this.dataImportsService.getTemplates(query);
  }

  @Get('templates/:id')
  @RequirePermissions('data-imports:view')
  @ApiOperation({ summary: 'Get import template by ID' })
  async getTemplateById(@Param('id') id: string) {
    return this.dataImportsService.getTemplateById(id);
  }

  @Get('logs')
  @RequirePermissions('data-imports:view-logs')
  @ApiOperation({ summary: 'List generic import execution logs (paginated)' })
  async getImportLogs(@Query() query: PaginationQueryDto & { sourceType?: string; status?: string }) {
    return this.dataImportsService.getImportLogs(query);
  }

  @Get('logs/:batchId')
  @RequirePermissions('data-imports:view-logs')
  @ApiOperation({ summary: 'Get import log details by batch ID' })
  async getImportLogByBatchId(@Param('batchId') batchId: string) {
    return this.dataImportsService.getImportLogByBatchId(batchId);
  }
}
