// src/external-incentive-uploads/external-incentive-uploads.controller.ts
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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ExternalIncentiveUploadsService } from './external-incentive-uploads.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('external-incentive-uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('external-incentive-uploads')
export class ExternalIncentiveUploadsController {
  constructor(private readonly service: ExternalIncentiveUploadsService) {}

  @Post('upload')
  @RequirePermissions('external-incentive:upload')
  @ApiOperation({ summary: 'Upload external incentive CSV/Excel file for staging' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        branchCode: { type: 'string', example: 'DELHI-01' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('branchCode') branchCode: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    if (!branchCode) throw new BadRequestException('branchCode is required.');

    return this.service.parseAndStageFile(
      file.buffer,
      file.originalname,
      branchCode,
      req.user.id,
    );
  }

  @Get('preview/:batchId')
  @RequirePermissions('external-incentive:view')
  @ApiOperation({ summary: 'Preview staged records for an external incentive import batch' })
  async getPreview(
    @Param('batchId') batchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.service.getPreview(batchId, query);
  }

  @Post('commit/:batchId')
  @RequirePermissions('external-incentive:commit')
  @ApiOperation({ summary: 'Commit valid staged records into incentive records' })
  async commitImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.service.commitImport(batchId, req.user.id);
  }

  @Post('rollback/:batchId')
  @RequirePermissions('external-incentive:rollback')
  @ApiOperation({ summary: 'Rollback a committed external incentive import batch' })
  async rollbackImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.service.rollbackImport(batchId, req.user.id);
  }
}
