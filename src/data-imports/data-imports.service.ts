// src/data-imports/data-imports.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DataImportsService {
  private readonly logger = new Logger(DataImportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createTemplate(data: any, createdBy: string) {
    const template = await this.prisma.importTemplate.create({
      data: {
        name: data.name,
        sourceType: data.sourceType,
        columnMappings: data.columnMappings,
        validationRules: data.validationRules || null,
        isActive: data.isActive ?? true,
        createdBy,
      },
    });

    await this.auditService.log({
      entityType: 'ImportTemplate',
      entityId: template.id,
      action: 'CREATE',
      newValues: template,
      changedBy: createdBy,
    });

    return template;
  }

  async getTemplates(filter: any) {
    const where: any = {};
    if (filter.sourceType) where.sourceType = filter.sourceType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive === 'true' || filter.isActive === true;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.importTemplate.findMany({
        where,
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.importTemplate.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getTemplateById(id: string) {
    const template = await this.prisma.importTemplate.findUnique({ where: { id } });
    if (!template) throw new NotFoundException(`Import template ${id} not found`);
    return template;
  }

  async getImportLogs(filter: any) {
    const where: any = {};
    if (filter.sourceType) where.sourceType = filter.sourceType;
    if (filter.status) where.status = filter.status;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.importLog.findMany({
        where,
        include: { template: true },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.importLog.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getImportLogByBatchId(batchId: string) {
    const log = await this.prisma.importLog.findUnique({
      where: { batchId },
      include: { template: true },
    });
    if (!log) throw new NotFoundException(`Import log batch ${batchId} not found`);
    return log;
  }
}
