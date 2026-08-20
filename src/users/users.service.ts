// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { GrantBranchAccessDto } from './dto/grant-branch-access.dto';
import { getPaginationParams, buildPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rbacService: RbacService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateUserDto, createdBy: string): Promise<any> {
    // Check username uniqueness
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) throw new BadRequestException('Username already exists');

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existingEmail) throw new BadRequestException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.executeInTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
          fullName: dto.fullName,
          isActive: dto.isActive ?? true,
          createdBy,
        },
        select: {
          id: true, username: true, email: true, fullName: true,
          phone: true, isActive: true, createdAt: true,
        },
      });

      // Assign roles
      if (dto.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({
            userId: user.id,
            roleId,
            assignedBy: createdBy,
          })),
        });
      }

      // Grant branch access
      if (dto.branchCodes.length > 0) {
        await tx.userBranchAccess.createMany({
          data: dto.branchCodes.map((branchCode, index) => ({
            userId: user.id,
            branchCode,
            isDefault: index === 0,
            grantedBy: createdBy,
          })),
        });
      }

      await this.auditService.log({
        entityType: 'User',
        entityId: user.id,
        action: 'CREATE',
        newValues: { ...user, roleIds: dto.roleIds, branchCodes: dto.branchCodes },
        changedBy: createdBy,
      });

      return {
        ...user,
        roleIds: dto.roleIds,
        branchCodes: dto.branchCodes,
      };
    });
  }

  async findAll(filter: UserFilterDto): Promise<PaginatedResponse<any>> {
    const { skip, take } = getPaginationParams(filter);
    const where: any = {};

    if (filter.search) {
      where.OR = [
        { username: { contains: filter.search, mode: 'insensitive' } },
        { fullName: { contains: filter.search, mode: 'insensitive' } },
        { email: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.branchCode) {
      where.branchAccesses = { some: { branchCode: filter.branchCode } };
    }

    const [items, totalCount] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, username: true, email: true, fullName: true,
          phone: true, isActive: true, lastLoginAt: true, createdAt: true,
          roles: { include: { role: { select: { id: true, name: true } } } },
          branchAccesses: { select: { branchCode: true, isDefault: true } },
        },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const mappedItems = items.map((u) => ({
      ...u,
      roles: u.roles.map((ur) => ur.role),
      branches: u.branchAccesses.map((ba) => ba.branchCode),
      defaultBranch: u.branchAccesses.find((ba) => ba.isDefault)?.branchCode,
    }));

    return buildPaginatedResponse(mappedItems, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async findOne(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, email: true, fullName: true,
        phone: true, isActive: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        roles: { include: { role: { select: { id: true, name: true, description: true } } } },
        branchAccesses: {
          include: { branch: { select: { code: true, name: true } } },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      roles: user.roles.map((ur) => ur.role),
      branchAccesses: user.branchAccesses.map((ba) => ({
        branchCode: ba.branchCode,
        branchName: ba.branch.name,
        isDefault: ba.isDefault,
      })),
    };
  }

  async update(id: string, dto: UpdateUserDto, updatedBy: string): Promise<any> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('User not found');

    const data: any = { updatedBy };
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    return this.prisma.executeInTransaction(async (tx) => {
      // Update role assignments if provided
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId, assignedBy: updatedBy })),
          });
        }
        this.rbacService.invalidateCache(id);
      }

      // Update branch access if provided
      if (dto.branchCodes) {
        await tx.userBranchAccess.deleteMany({ where: { userId: id } });
        if (dto.branchCodes.length > 0) {
          await tx.userBranchAccess.createMany({
            data: dto.branchCodes.map((branchCode, index) => ({
              userId: id,
              branchCode,
              isDefault: index === 0,
              grantedBy: updatedBy,
            })),
          });
        }
      }

      const user = await tx.user.update({
        where: { id },
        data,
        select: {
          id: true, username: true, email: true, fullName: true,
          phone: true, isActive: true, lastLoginAt: true, createdAt: true,
        },
      });

      await this.auditService.log({
        entityType: 'User',
        entityId: id,
        action: 'UPDATE',
        oldValues: existing,
        newValues: { ...user, roleIds: dto.roleIds, branchCodes: dto.branchCodes },
        changedBy: updatedBy,
      });

      return user;
    });
  }

  async assignRoles(id: string, dto: AssignRolesDto, assignedBy: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.executeInTransaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (dto.roleIds.length > 0) {
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId, assignedBy })),
        });
      }
    });

    this.rbacService.invalidateCache(id);
    this.logger.log(`Roles updated for user ${id} by ${assignedBy}`);
  }

  async grantBranchAccess(id: string, dto: GrantBranchAccessDto, grantedBy: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.executeInTransaction(async (tx) => {
      // If setAsDefault, clear existing default
      if (dto.setAsDefault) {
        await tx.userBranchAccess.updateMany({
          where: { userId: id, isDefault: true },
          data: { isDefault: false },
        });
      }

      for (const branchCode of dto.branchCodes) {
        await tx.userBranchAccess.upsert({
          where: { userId_branchCode: { userId: id, branchCode } },
          create: { userId: id, branchCode, isDefault: dto.setAsDefault ?? false, grantedBy },
          update: {},
        });
      }
    });
  }

  async removeBranchAccess(id: string, branchCode: string): Promise<void> {
    await this.prisma.userBranchAccess.delete({
      where: { userId_branchCode: { userId: id, branchCode } },
    }).catch(() => {
      throw new NotFoundException('Branch access not found');
    });
  }
}