// src/sales/sales.controller.ts
import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Body,
  UseGuards,
  Req,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { SalesQueryDto } from './dto/sales-query.dto';

@ApiTags('sales-upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  private readonly logger = new Logger(SalesController.name);

  constructor(private readonly salesService: SalesService) {}

  @Post('upload')
  @RequirePermissions('sales:upload')
  @ApiOperation({ summary: 'Upload sales achievements Excel/CSV file for staging' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!this.logger) {
      (this as any).logger = new Logger(SalesController.name);
    }
    this.logger.debug('--- NESTJS UPLOAD CONTROLLER REACHED ---');
    this.logger.debug(`File name: ${file?.originalname}`);
    this.logger.debug(`File size: ${file?.size || (file as any).buffer?.length}`);
    if (!file) throw new BadRequestException('No file uploaded.');

    return this.salesService.parseAndStageSales(
      file.buffer,
      file.originalname,
      req.user.id,
    );
  }

  @Get('preview/:batchId')
  @RequirePermissions('sales:view')
  @ApiOperation({ summary: 'Preview staged records for a sales import batch' })
  async getPreview(
    @Param('batchId') batchId: string,
    @Query() query: SalesQueryDto,
  ) {
    return this.salesService.getPreview(batchId, query);
  }

  @Post('commit/:batchId')
  @RequirePermissions('sales:commit')
  @ApiOperation({ summary: 'Commit valid staged records into RAW_SALES table' })
  async commitImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.salesService.commitImport(batchId, req.user.id);
  }

  @Post('rollback/:batchId')
  @RequirePermissions('sales:rollback')
  @ApiOperation({ summary: 'Rollback and delete a committed sales import batch' })
  async rollbackImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.salesService.rollbackImport(batchId, req.user.id);
  }

  @Get('records')
  @RequirePermissions('sales:view')
  @ApiOperation({ summary: 'Get paginated list of live RAW_SALES records' })
  async querySales(@Query() query: SalesQueryDto, @Req() req: any) {
    // Extract branches the user has access to from token
    const userBranches = req.user.branches || [];
    return this.salesService.querySales(query, userBranches);
  }

  @Get('history')
  @RequirePermissions('sales:view')
  @ApiOperation({ summary: 'Get upload history logs' })
  async getUploadHistory(@Query() query: SalesQueryDto, @Req() req: any) {
    const userBranches = req.user.branches || [];
    return this.salesService.getUploadHistory(userBranches, query);
  }
}
