// src/rbac/rbac.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RbacService } from './rbac.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './permissions.decorator';

@ApiTags('rbac')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Get('roles')
  @RequirePermissions('rbac:manage-roles')
  @ApiOperation({ summary: 'List all system roles and permissions' })
  async getRoles() {
    return this.rbacService.getRoles();
  }

  @Get('permissions')
  @RequirePermissions('rbac:manage-permissions')
  @ApiOperation({ summary: 'List all available permission codes' })
  async getPermissions() {
    return this.rbacService.getPermissions();
  }

  @Post('users/:userId/roles')
  @RequirePermissions('rbac:assign-roles')
  @ApiOperation({ summary: 'Assign a role to a user' })
  async assignRole(
    @Param('userId') userId: string,
    @Body('roleId') roleId: string,
    @Req() req: any,
  ) {
    return this.rbacService.assignRoleToUser(userId, roleId, req.user.id);
  }

  @Post('users/:userId/branches')
  @RequirePermissions('rbac:grant-branches')
  @ApiOperation({ summary: 'Grant per-user per-branch access' })
  async grantBranchAccess(
    @Param('userId') userId: string,
    @Body() body: { branchCode: string; isDefault?: boolean },
    @Req() req: any,
  ) {
    return this.rbacService.grantUserBranchAccess(userId, body.branchCode, body.isDefault, req.user.id);
  }
}
