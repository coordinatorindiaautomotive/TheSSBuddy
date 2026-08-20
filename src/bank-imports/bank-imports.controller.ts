// src/bank-imports/bank-imports.controller.ts
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
import { BankImportsService } from './bank-imports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';

@ApiTags('bank-imports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('bank-imports')
export class BankImportsController {
  constructor(private readonly bankImportsService: BankImportsService) {}

  @Post('upload')
  @RequirePermissions('bank-imports:upload')
  @ApiOperation({ summary: 'Upload bank statement CSV/Excel file for staging' })
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

    return this.bankImportsService.parseAndStageFile(
      file.buffer,
      file.originalname,
      branchCode,
      req.user.id,
    );
  }

  @Get('preview/:batchId')
  @RequirePermissions('bank-imports:view')
  @ApiOperation({ summary: 'Preview staged records for a bank statement import batch' })
  async getPreview(
    @Param('batchId') batchId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.bankImportsService.getPreview(batchId, query);
  }

  @Post('commit/:batchId')
  @RequirePermissions('bank-imports:commit')
  @ApiOperation({ summary: 'Commit valid staged records into cash reconciliation flow' })
  async commitImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.bankImportsService.commitImport(batchId, req.user.id);
  }

  @Post('rollback/:batchId')
  @RequirePermissions('bank-imports:rollback')
  @ApiOperation({ summary: 'Rollback a committed bank statement import batch' })
  async rollbackImport(@Param('batchId') batchId: string, @Req() req: any) {
    return this.bankImportsService.rollbackImport(batchId, req.user.id);
  }
}
