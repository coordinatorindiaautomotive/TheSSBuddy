// src/outstanding/outstanding.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { OutstandingService } from './outstanding.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';

@ApiTags('outstanding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('outstanding')
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get()
  @RequirePermissions('outstanding:view')
  @ApiOperation({ summary: 'Get outstanding master records' })
  async getOutstandingMaster(
    @Query('month') month?: number,
    @Query('year') year?: number,
    @Query('branchFilter') branchFilter?: string,
  ) {
    const m = month ? Number(month) : undefined;
    const y = year ? Number(year) : undefined;
    return this.outstandingService.getOutstandingMaster(m, y, branchFilter);
  }

  @Post('upload')
  @RequirePermissions('outstanding:upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload Excel file to populate outstanding master balances' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @Body('rewrite') rewrite?: string,
    @Body('month') month?: string,
    @Body('year') year?: string,
    @Req() req?: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const isRewrite = rewrite === 'true' || rewrite === '1';
    const m = month ? Number(month) : undefined;
    const y = year ? Number(year) : undefined;
    return this.outstandingService.uploadExcel(file.buffer, isRewrite, m, y, req.user?.id);
  }

  @Post('sync')
  @RequirePermissions('outstanding:sync')
  @ApiOperation({ summary: 'Trigger sync outstanding balances from Tally Gateway' })
  async syncTally(
    @Body('month') month?: number,
    @Body('year') year?: number,
  ) {
    const m = month ? Number(month) : undefined;
    const y = year ? Number(year) : undefined;
    return this.outstandingService.syncTallyOutstanding(m, y);
  }
}
