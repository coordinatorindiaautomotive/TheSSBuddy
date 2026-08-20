// src/retail-sales-upload/retail-sales-upload.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { RetailSalesUploadService } from './retail-sales-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('retail-sales-upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('retail-sales-upload')
export class RetailSalesUploadController {
  constructor(private readonly service: RetailSalesUploadService) {}

  /**
   * POST /retail-sales-upload/upload
   * Upload 1-month, 2-month, 6-month data in one shot.
   * Automatically detects periods in the file and rewrites those periods.
   */
  @Post('upload')
  @RequirePermissions('retail-sales:upload')
  @ApiOperation({
    summary: 'Upload retail sales Excel/CSV — rewrites existing data for detected periods',
    description:
      'Accepts any date range (1 month, 2 months, 6 months …). ' +
      'For every Month Year found in the file, existing records are deleted and replaced. ' +
      'Re-uploading the same file is always safe — no duplicates will be created.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel (.xlsx/.xls) or CSV file matching the retail sales format',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) throw new BadRequestException('No file uploaded.');
    return this.service.uploadAndRewrite(file.buffer, file.originalname, req.user.id);
  }

  /**
   * GET /retail-sales-upload/template
   * Download sample Excel or CSV template
   */
  @Get('template')
  @RequirePermissions('retail-sales:view')
  @ApiOperation({ summary: 'Download sample retail sales upload template (.xlsx or .csv)' })
  @ApiQuery({ name: 'format', required: false, enum: ['xlsx', 'csv'] })
  async downloadTemplate(@Query('format') format: 'csv' | 'xlsx' = 'xlsx', @Res() res: Response) {
    const buffer = await this.service.generateTemplate(format);
    const ext = format === 'csv' ? 'csv' : 'xlsx';
    const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="retail_sales_template.${ext}"`);
    return res.send(buffer);
  }

  /**
   * GET /retail-sales-upload/history
   * Returns all upload log entries (most recent first)
   */
  @Get('history')
  @RequirePermissions('retail-sales:view')
  @ApiOperation({ summary: 'Get upload history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ) {
    return this.service.getUploadHistory(page, pageSize);
  }

  /**
   * DELETE /retail-sales-upload/batch/:batchId
   * Rollback / delete uploaded batch records and history log
   */
  @Delete('batch/:batchId')
  @RequirePermissions('retail-sales:upload')
  @ApiOperation({ summary: 'Rollback an uploaded batch by ID' })
  async deleteBatch(@Param('batchId') batchId: string) {
    return this.service.deleteBatch(batchId);
  }

  /**
   * GET /retail-sales-upload/records
   * Paginated records with optional filters
   */
  @Get('records')
  @RequirePermissions('retail-sales:view')
  @ApiOperation({ summary: 'Query retail sales records with optional filters' })
  @ApiQuery({ name: 'monthYear', required: false, example: 'Jun 2026' })
  @ApiQuery({ name: 'dealerCode', required: false })
  @ApiQuery({ name: 'consignee', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async getRecords(
    @Query('monthYear') monthYear?: string,
    @Query('dealerCode') dealerCode?: string,
    @Query('consignee') consignee?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('pageSize', new DefaultValuePipe(50), ParseIntPipe) pageSize: number = 50,
  ) {
    return this.service.getRecords({ monthYear, dealerCode, consignee, page, pageSize });
  }

  /**
   * GET /retail-sales-upload/summary
   * Aggregated totals grouped by monthYear + dealerCode
   */
  @Get('summary')
  @RequirePermissions('retail-sales:view')
  @ApiOperation({ summary: 'Aggregated summary grouped by Month Year and Dealer Code' })
  @ApiQuery({ name: 'monthYear', required: false, example: 'Jun 2026' })
  async getSummary(@Query('monthYear') monthYear?: string) {
    return this.service.getSummary(monthYear);
  }

  /**
   * GET /retail-sales-upload/periods
   * Returns distinct Month Year values present in the database
   */
  @Get('periods')
  @RequirePermissions('retail-sales:view')
  @ApiOperation({ summary: 'Get all available Month Year periods in the database' })
  async getPeriods() {
    return this.service.getAvailablePeriods();
  }
}
