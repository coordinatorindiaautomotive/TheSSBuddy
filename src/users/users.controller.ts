// src/users/users.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { GrantBranchAccessDto } from './dto/grant-branch-access.dto';
import { UuidParamDto } from '../common/dto/id-param.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions('user:create')
  @ApiOperation({ summary: 'Create a new user' })
  async create(@Body() dto: CreateUserDto, @Req() req: any) {
    return this.usersService.create(dto, req.user.id);
  }

  @Get()
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'List users with pagination and filters' })
  async findAll(@Query() filter: UserFilterDto) {
    return this.usersService.findAll(filter);
  }

  @Get(':id')
  @RequirePermissions('user:read')
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param() params: UuidParamDto) {
    return this.usersService.findOne(params.id);
  }

  @Put(':id')
  @RequirePermissions('user:update')
  @ApiOperation({ summary: 'Update user' })
  async update(
    @Param() params: UuidParamDto,
    @Body() dto: UpdateUserDto,
    @Req() req: any,
  ) {
    return this.usersService.update(params.id, dto, req.user.id);
  }

  @Post(':id/roles')
  @RequirePermissions('user:assign-roles')
  @ApiOperation({ summary: 'Assign roles to user (replaces existing)' })
  async assignRoles(
    @Param() params: UuidParamDto,
    @Body() dto: AssignRolesDto,
    @Req() req: any,
  ) {
    await this.usersService.assignRoles(params.id, dto, req.user.id);
    return { message: 'Roles updated' };
  }

  @Post(':id/branches')
  @RequirePermissions('user:grant-branch')
  @ApiOperation({ summary: 'Grant branch access to user' })
  async grantBranchAccess(
    @Param() params: UuidParamDto,
    @Body() dto: GrantBranchAccessDto,
    @Req() req: any,
  ) {
    await this.usersService.grantBranchAccess(params.id, dto, req.user.id);
    return { message: 'Branch access updated' };
  }

  @Delete(':id/branches/:code')
  @RequirePermissions('user:grant-branch')
  @ApiOperation({ summary: 'Remove branch access from user' })
  async removeBranchAccess(
    @Param('id') id: string,
    @Param('code') code: string,
  ) {
    await this.usersService.removeBranchAccess(id, code);
    return { message: 'Branch access removed' };
  }
}