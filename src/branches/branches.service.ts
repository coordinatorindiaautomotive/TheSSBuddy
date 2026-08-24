// src/branches/branches.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchFilterDto } from './dto/branch-filter.dto';
import { getPaginationParams, buildPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  async create(dto: CreateBranchDto, createdBy: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code: dto.code } });
    if (existing) throw new BadRequestException('Branch code already exists');

    const branch = await this.prisma.branch.create({
      data: {
        code: dto.code,
        name: dto.name,
        region: dto.region,
        address: dto.address,
        isActive: dto.isActive ?? true,
        type: dto.type,
        consignee: dto.consignee,
        incharge: dto.incharge,
        phone: dto.phone,
        email: dto.email,
        area: dto.area,
        coordinates: dto.coordinates,
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
        allowedCategories: dto.allowedCategories,
        allowedPartyTypes: dto.allowedPartyTypes,
        createdBy,
      },
    });

    await this.auditService.log({
      entityType: 'Branch',
      entityId: branch.code,
      action: 'CREATE',
      newValues: branch,
      changedBy: createdBy,
    });

    return branch;
  }

  async findAll(filter: BranchFilterDto): Promise<PaginatedResponse<any>> {
    const { skip, take } = getPaginationParams(filter);
    const where: any = {};

    // Strict branch isolation: branch user can only see their assigned branches
    this.branchIsolation.mergeBranchFilter(where, 'code');

    if (filter.search) {
      where.OR = [
        { code: { contains: filter.search, mode: 'insensitive' } },
        { name: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter.region) where.region = filter.region;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const [items, totalCount] = await Promise.all([
      this.prisma.branch.findMany({ where, skip, take, orderBy: { code: 'asc' } }),
      this.prisma.branch.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async findOne(code: string) {
    const branch = await this.prisma.branch.findUnique({ where: { code: code } });
    if (!branch) throw new NotFoundException('Branch not found');
    return branch;
  }

  async update(code: string, dto: UpdateBranchDto, updatedBy: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code: code } });
    if (!existing) throw new NotFoundException('Branch not found');

    const branch = await this.prisma.branch.update({
      where: { code: code },
      data: {
        name: dto.name,
        region: dto.region,
        address: dto.address,
        isActive: dto.isActive,
        type: dto.type,
        consignee: dto.consignee,
        incharge: dto.incharge,
        phone: dto.phone,
        email: dto.email,
        area: dto.area,
        coordinates: dto.coordinates,
        latitude: dto.latitude,
        longitude: dto.longitude,
        openingDate: dto.openingDate ? new Date(dto.openingDate) : undefined,
        allowedCategories: dto.allowedCategories,
        allowedPartyTypes: dto.allowedPartyTypes,
        updatedBy,
      },
    });

    await this.auditService.log({
      entityType: 'Branch',
      entityId: code,
      action: 'UPDATE',
      oldValues: existing,
      newValues: branch,
      changedBy: updatedBy,
    });

    return branch;
  }

  async remove(code: string, deletedBy: string) {
    const existing = await this.prisma.branch.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Branch not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.userBranchAccess.deleteMany({ where: { branchCode: code } });
      await tx.branch.delete({ where: { code } });
    });

    await this.auditService.log({
      entityType: 'Branch',
      entityId: code,
      action: 'DELETE',
      oldValues: existing,
      changedBy: deletedBy,
    });

    return { success: true, message: `Branch ${code} permanently deleted` };
  }
}