// src/rule-engine/rule-engine.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RuleEngineService } from './rule-engine.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';
import { RuleType } from '@prisma/client';

@ApiTags('rule-engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('rule-engine')
export class RuleEngineController {
  constructor(private readonly ruleEngineService: RuleEngineService) {}

  @Post('rules')
  @RequirePermissions('rule-engine:create')
  @ApiOperation({ summary: 'Create generic rule master definition' })
  async createRuleMaster(@Body() body: any, @Req() req: any) {
    return this.ruleEngineService.createRuleMaster(body, req.user.id);
  }

  @Get('rules')
  @RequirePermissions('rule-engine:view')
  @ApiOperation({ summary: 'List rule masters (paginated)' })
  async getRuleMasters(@Query() query: PaginationQueryDto & { ruleType?: RuleType; isActive?: boolean }) {
    return this.ruleEngineService.getRuleMasters(query);
  }

  @Get('rules/:id')
  @RequirePermissions('rule-engine:view')
  @ApiOperation({ summary: 'Get rule master details by ID' })
  async getRuleMasterById(@Param('id') id: string) {
    return this.ruleEngineService.getRuleMasterById(id);
  }

  @Post('versions')
  @RequirePermissions('rule-engine:create-version')
  @ApiOperation({ summary: 'Create new version for a rule master with conditions' })
  async createRuleVersion(@Body() body: any, @Req() req: any) {
    return this.ruleEngineService.createRuleVersion(body, req.user.id);
  }

  @Post('execute')
  @RequirePermissions('rule-engine:execute')
  @ApiOperation({ summary: 'Execute rule by code against a data context object' })
  async executeRule(@Body() body: { ruleCode: string; context: Record<string, any> }) {
    return this.ruleEngineService.executeRule(body.ruleCode, body.context || {});
  }
}
