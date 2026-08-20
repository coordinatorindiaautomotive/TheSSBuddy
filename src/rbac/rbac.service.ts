// src/rbac/rbac.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);
  private permissionCache = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async isUserSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) return false;
    if (user.username.toLowerCase() === 'admin') return true;

    return user.roles.some((ur) => {
      const name = (ur.role?.name || '').toUpperCase();
      return name.includes('ADMIN') || name.includes('SUPER') || name.includes('HO_FINANCE');
    });
  }

  async getUserPermissions(userId: string): Promise<Set<string>> {
    const cached = this.permissionCache.get(userId);
    if (cached) return cached;

    const [user, userRoles] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.userRole.findMany({
        where: { userId },
        include: {
          role: true,
        },
      }),
    ]);

    const permissions = new Set<string>();

    const isSuperAdmin =
      user?.username.toLowerCase() === 'admin' ||
      userRoles.some((ur) => {
        const name = (ur.role?.name || '').toUpperCase();
        return name.includes('ADMIN') || name.includes('SUPER');
      });

    if (isSuperAdmin) {
      permissions.add('*');
      permissions.add('incentive-scheme:create');
      permissions.add('incentive-scheme:read');
      permissions.add('incentive-scheme:update');
      permissions.add('incentive-scheme:delete');
      permissions.add('incentive:read');
      permissions.add('incentive:create');
      permissions.add('incentive:update');
      permissions.add('outstanding:view');
      permissions.add('outstanding:upload');
      permissions.add('outstanding:sync');
      permissions.add('users:manage-roles');
      permissions.add('rbac:manage-roles');
      permissions.add('rbac:manage-permissions');
      permissions.add('rbac:assign-roles');
      permissions.add('rbac:grant-branches');
      permissions.add('reports:view');
      permissions.add('party:read');
      permissions.add('party:create');
      permissions.add('party:update');
    } else {
      // Standard permissions
      permissions.add('dashboard:view');
      permissions.add('dashboard:read');
      permissions.add('branch:read');
      permissions.add('branch:view');
      permissions.add('branches:read');
      permissions.add('outstanding:view');
      permissions.add('incentive:read');
      permissions.add('incentive-scheme:read');
      permissions.add('reports:view');
      permissions.add('party:read');
      permissions.add('party:create');
      permissions.add('party:update');
      permissions.add('assets:read');
      permissions.add('helpdesk:read');
      permissions.add('helpdesk:write');
      permissions.add('cashbook:read');
    }

    this.permissionCache.set(userId, permissions);
    return permissions;
  }

  async hasPermission(userId: string, permissionCode: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.has('*') || permissions.has(permissionCode);
  }

  async hasAllPermissions(userId: string, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions.has('*')) return true;
    return permissionCodes.every((code) => permissions.has(code));
  }

  async hasAnyPermission(userId: string, permissionCodes: string[]): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    if (permissions.has('*')) return true;
    return permissionCodes.some((code) => permissions.has(code));
  }

  invalidateCache(userId: string): void {
    this.permissionCache.delete(userId);
    this.logger.debug(`Invalidated permission cache for user ${userId}`);
  }

  invalidateAllCaches(): void {
    this.permissionCache.clear();
    this.logger.debug('Invalidated all permission caches');
  }

  async getUserBranches(userId: string): Promise<string[]> {
    const isSuper = await this.isUserSuperAdmin(userId);
    if (isSuper) {
      // SuperAdmin has universal access across all branches
      return [];
    }

    const accesses = await this.prisma.userBranchAccess.findMany({
      where: { userId },
      select: { branchCode: true },
    });
    return accesses.map((a) => a.branchCode);
  }

  async getUserDefaultBranch(userId: string): Promise<string | null> {
    const defaultAccess = await this.prisma.userBranchAccess.findFirst({
      where: { userId, isDefault: true },
      select: { branchCode: true },
    });
    if (defaultAccess) return defaultAccess.branchCode;

    const anyAccess = await this.prisma.userBranchAccess.findFirst({
      where: { userId },
      select: { branchCode: true },
    });
    return anyAccess?.branchCode || null;
  }

  async getRoles() {
    return this.prisma.role.findMany();
  }

  async getPermissions() {
    return this.prisma.permission.findMany();
  }

  async assignRoleToUser(userId: string, roleId: string, grantedBy?: string) {
    this.invalidateCache(userId);
    return this.prisma.userRole.create({
      data: {
        userId,
        roleId,
      },
    });
  }

  async grantUserBranchAccess(userId: string, branchCode: string, isDefault: boolean = false, grantedBy?: string) {
    if (isDefault) {
      await this.prisma.userBranchAccess.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    return this.prisma.userBranchAccess.upsert({
      where: {
        userId_branchCode: { userId, branchCode },
      },
      create: {
        userId,
        branchCode,
        isDefault,
        grantedBy,
      },
      update: {
        isDefault,
      },
    });
  }
}