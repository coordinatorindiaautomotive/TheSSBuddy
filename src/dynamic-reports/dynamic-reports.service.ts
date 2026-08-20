// src/dynamic-reports/dynamic-reports.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DynamicReportsService {
  private readonly logger = new Logger(DynamicReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  async createLayout(data: any, userId: string) {
    return { id: 'layout-1', name: data.name, dataSource: data.dataSource };
  }

  async getLayouts(userId: string, pagination: any) {
    return buildPaginatedResponse([], 0, pagination.page || 1, pagination.pageSize || 50);
  }

  async getLayoutById(id: string) {
    return { id, name: 'Default Layout', dataSource: 'IncentiveRecord', columns: [] };
  }

  async executeLayout(layoutId: string, runtimeFilters: any) {
    return buildPaginatedResponse([], 0, runtimeFilters.page || 1, runtimeFilters.pageSize || 50);
  }
}
