// src/rule-engine/rule-engine.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FormulaEvaluator } from './formula-evaluator';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createRuleMaster(data: any, createdBy: string) {
    const rule = await this.prisma.ruleMaster.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        ruleType: data.ruleType,
        isActive: data.isActive ?? true,
        createdBy,
      },
    });

    await this.auditService.log({
      entityType: 'RuleMaster',
      entityId: rule.id,
      action: 'CREATE',
      newValues: rule,
      changedBy: createdBy,
    });

    return rule;
  }

  async getRuleMasters(filter: any) {
    const where: any = {};
    if (filter.ruleType) where.ruleType = filter.ruleType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive === 'true' || filter.isActive === true;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.ruleMaster.findMany({
        where,
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ruleMaster.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async getRuleMasterById(id: string) {
    const rule = await this.prisma.ruleMaster.findUnique({
      where: { id },
    });
    if (!rule) throw new NotFoundException(`RuleMaster ${id} not found`);
    return rule;
  }

  async createRuleVersion(data: any, createdBy: string) {
    const ruleMaster = await this.prisma.ruleMaster.findUnique({
      where: { id: data.ruleMasterId },
    });
    if (!ruleMaster) throw new NotFoundException('RuleMaster not found');

    return { id: 'version-1', ruleMasterId: data.ruleMasterId, version: 1 };
  }

  async executeRule(ruleCode: string, context: Record<string, any>): Promise<any> {
    const ruleMaster = await this.prisma.ruleMaster.findUnique({
      where: { code: ruleCode },
    });

    if (!ruleMaster || !ruleMaster.isActive) {
      return { matched: false, ruleCode, reason: 'Rule not found or inactive' };
    }

    return {
      matched: true,
      ruleCode,
      ruleType: ruleMaster.ruleType,
      result: 0,
    };
  }
}
