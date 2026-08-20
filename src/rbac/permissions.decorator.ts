// src/rbac/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const REQUIRE_ALL_PERMISSIONS_KEY = 'requireAll';

/**
 * Decorator to specify required permissions for an endpoint.
 * By default, the user needs at least ONE of the listed permissions (OR logic).
 * Use @RequireAllPermissions() to require ALL permissions (AND logic).
 *
 * @example
 * @RequirePermissions('incentive:read', 'incentive:write')
 * @Get()
 * findAll() { ... }
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * When placed alongside @RequirePermissions, changes behavior from OR to AND.
 */
export const RequireAllPermissions = () =>
  SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, true);