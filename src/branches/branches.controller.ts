// src/branches/branches.controller.ts
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
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { BranchFilterDto } from './dto/branch-filter.dto';
import { CodeParamDto } from '../common/dto/code-param.dto';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post()
  @RequirePermissions('branch:create')
  @ApiOperation({ summary: 'Create a new branch' })
  async create(@Body() dto: CreateBranchDto, @Req() req: any) {
    return this.branchesService.create(dto, req.user.id);
  }

  @Get()
  @RequirePermissions('branch:read')
  @ApiOperation({ summary: 'List branches with pagination' })
  async findAll(@Query() filter: BranchFilterDto) {
    return this.branchesService.findAll(filter);
  }

  @Get(':code')
  @RequirePermissions('branch:read')
  @ApiOperation({ summary: 'Get branch by code' })
  async findOne(@Param() params: CodeParamDto) {
    return this.branchesService.findOne(params.code);
  }

  @Put(':code')
  @RequirePermissions('branch:update')
  @ApiOperation({ summary: 'Update branch' })
  async update(
    @Param() params: CodeParamDto,
    @Body() dto: UpdateBranchDto,
    @Req() req: any,
  ) {
    return this.branchesService.update(params.code, dto, req.user.id);
  }

  @Delete(':code')
  @RequirePermissions('branch:delete')
  @ApiOperation({ summary: 'Delete branch' })
  async remove(@Param() params: CodeParamDto, @Req() req: any) {
    return this.branchesService.remove(params.code, req.user.id);
  }
}