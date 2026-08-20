// src/workflow/workflow.controller.ts
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
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';
import { WorkflowEntityType } from '@prisma/client';

@ApiTags('workflow')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post('definitions')
  @RequirePermissions('workflow:create-definition')
  @ApiOperation({ summary: 'Create multi-step workflow definition' })
  async createDefinition(@Body() body: any, @Req() req: any) {
    return this.workflowService.createDefinition(body, req.user.id);
  }

  @Get('definitions')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'List workflow definitions (paginated)' })
  async getDefinitions(@Query() query: PaginationQueryDto & { entityType?: WorkflowEntityType; isActive?: boolean }) {
    return this.workflowService.getDefinitions(query);
  }

  @Post('submit')
  @RequirePermissions('workflow:submit')
  @ApiOperation({ summary: 'Submit an entity (incentive/cash/import) into workflow' })
  async submitToWorkflow(
    @Body() body: { entityType: WorkflowEntityType; entityId: string },
    @Req() req: any,
  ) {
    return this.workflowService.submitToWorkflow(body.entityType, body.entityId, req.user.id);
  }

  @Post('instances/:id/action')
  @RequirePermissions('workflow:approve')
  @ApiOperation({ summary: 'Approve or reject a workflow step instance' })
  async processStepAction(
    @Param('id') instanceId: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; remarks: string },
    @Req() req: any,
  ) {
    return this.workflowService.processStepAction(instanceId, body.action, body.remarks, req.user.id);
  }

  @Get('instances/:id/history')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Get full step approval history for a workflow instance' })
  async getInstanceHistory(@Param('id') instanceId: string) {
    return this.workflowService.getInstanceHistory(instanceId);
  }

  @Get('pending')
  @RequirePermissions('workflow:view')
  @ApiOperation({ summary: 'Get pending workflow step assignments for current user' })
  async getPendingAssignments(@Query() query: PaginationQueryDto, @Req() req: any) {
    return this.workflowService.getPendingAssignments(req.user.id, query);
  }
}
