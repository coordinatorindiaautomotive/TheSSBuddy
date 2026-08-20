// src/rbac/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, REQUIRE_ALL_PERMISSIONS_KEY } from './permissions.decorator';
import { RbacService } from './rbac.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Set up branch isolation context from user's session
    const isSuperAdmin = await this.rbacService.isUserSuperAdmin(user.id);
    const branchCodes = await this.rbacService.getUserBranches(user.id);
    const defaultBranch = await this.rbacService.getUserDefaultBranch(user.id);
    this.branchIsolation.setContext({
      userId: user.id,
      isSuperAdmin,
      branchCodes,
      defaultBranchCode: defaultBranch || undefined,
    });
    request.branchContext = this.branchIsolation.getContext();

    // Check permissions if decorator is present
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required for this endpoint
    }

    const requireAll = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ALL_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireAll) {
      const hasAll = await this.rbacService.hasAllPermissions(user.id, requiredPermissions);
      if (!hasAll) {
        this.logger.warn(
          `User ${user.id} denied access: missing ALL permissions [${requiredPermissions.join(', ')}]`,
        );
        throw new ForbiddenException(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
        );
      }
    } else {
      const hasAny = await this.rbacService.hasAnyPermission(user.id, requiredPermissions);
      if (!hasAny) {
        this.logger.warn(
          `User ${user.id} denied access: missing ANY permission from [${requiredPermissions.join(', ')}]`,
        );
        throw new ForbiddenException(
          `Insufficient permissions. Required one of: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}