// src/workflow/workflow.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WorkflowEntityType, WorkflowInstanceStatus, WorkflowStepStatus } from '@prisma/client';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createDefinition(data: any, createdBy: string) {
    return this.prisma.executeInTransaction(async (tx) => {
      const definition = await tx.workflowDefinition.create({
        data: {
          code: data.code,
          name: data.name,
          entityType: data.entityType,
          description: data.description || null,
          isActive: data.isActive ?? true,
          createdBy,
          steps: {
            create: (data.steps || []).map((step: any, idx: number) => ({
              stepNumber: step.stepNumber || idx + 1,
              name: step.name,
              stepType: step.stepType || 'APPROVAL',
              assigneeType: step.assigneeType || 'ROLE',
              assigneeValue: step.assigneeValue,
              timeoutHours: step.timeoutHours || null,
              isRequired: step.isRequired ?? true,
              conditionExpression: step.conditionExpression || null,
              createdBy,
            })),
          },
        },
        include: { steps: true },
      });

      await this.auditService.log({
        entityType: 'WorkflowDefinition',
        entityId: definition.id,
        action: 'CREATE',
        newValues: definition,
        changedBy: createdBy,
      });

      return definition;
    });
  }

  async getDefinitions(filter: any) {
    const where: any = {};
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive === 'true' || filter.isActive === true;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.workflowDefinition.findMany({
        where,
        include: { steps: { orderBy: { stepNumber: 'asc' } } },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflowDefinition.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async submitToWorkflow(
    entityType: WorkflowEntityType,
    entityId: string,
    initiatedBy: string,
  ) {
    const definition = await this.prisma.workflowDefinition.findFirst({
      where: { entityType, isActive: true },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!definition || definition.steps.length === 0) {
      throw new BadRequestException(`No active workflow definition configured for entity type ${entityType}`);
    }

    const firstStep = definition.steps[0];

    return this.prisma.executeInTransaction(async (tx) => {
      const instance = await tx.workflowInstance.create({
        data: {
          workflowDefinitionId: definition.id,
          entityType,
          entityId,
          status: 'IN_PROGRESS',
          currentStepNumber: 1,
          initiatedBy,
        },
      });

      const assignment = await tx.workflowStepAssignment.create({
        data: {
          workflowInstanceId: instance.id,
          workflowStepId: firstStep.id,
          assignedTo: initiatedBy,
          status: 'PENDING',
        },
      });

      await tx.workflowStepHistory.create({
        data: {
          workflowInstanceId: instance.id,
          workflowStepId: firstStep.id,
          action: 'SUBMITTED',
          actedBy: initiatedBy,
          remarks: 'Item submitted to workflow',
        },
      });

      await this.auditService.log({
        entityType: 'WorkflowInstance',
        entityId: instance.id,
        action: 'CREATE',
        newValues: { entityType, entityId, currentStepNumber: 1 },
        changedBy: initiatedBy,
      });

      return { instance, assignment };
    });
  }

  async processStepAction(
    instanceId: string,
    action: 'APPROVE' | 'REJECT',
    remarks: string,
    actionBy: string,
  ) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflowDefinition: {
          include: { steps: { orderBy: { stepNumber: 'asc' } } },
        },
      },
    });

    if (!instance) throw new NotFoundException(`Workflow instance ${instanceId} not found`);
    if (instance.status !== 'IN_PROGRESS') {
      throw new BadRequestException(`Workflow instance is already ${instance.status}`);
    }

    const steps = instance.workflowDefinition.steps;
    const currentStep = steps.find((s) => s.stepNumber === instance.currentStepNumber);
    if (!currentStep) {
      throw new BadRequestException(`Current step ${instance.currentStepNumber} not found in workflow definition`);
    }

    return this.prisma.executeInTransaction(async (tx) => {
      const stepStatus: WorkflowStepStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

      await tx.workflowStepAssignment.updateMany({
        where: {
          workflowInstanceId: instanceId,
          workflowStepId: currentStep.id,
          status: 'PENDING',
        },
        data: {
          status: stepStatus,
          actedAt: new Date(),
          remarks,
        },
      });

      await tx.workflowStepHistory.create({
        data: {
          workflowInstanceId: instanceId,
          workflowStepId: currentStep.id,
          action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          actedBy: actionBy,
          remarks,
        },
      });

      let nextStatus: WorkflowInstanceStatus = instance.status;
      let nextStepNumber = instance.currentStepNumber;

      if (action === 'REJECT') {
        nextStatus = 'REJECTED';
      } else {
        const hasNext = steps.some((s) => s.stepNumber > instance.currentStepNumber);
        if (hasNext) {
          nextStepNumber = instance.currentStepNumber + 1;
          const nextStep = steps.find((s) => s.stepNumber === nextStepNumber)!;

          await tx.workflowStepAssignment.create({
            data: {
              workflowInstanceId: instanceId,
              workflowStepId: nextStep.id,
              assignedTo: actionBy,
              status: 'PENDING',
            },
          });
        } else {
          nextStatus = 'APPROVED';
        }
      }

      const updatedInstance = await tx.workflowInstance.update({
        where: { id: instanceId },
        data: {
          status: nextStatus,
          currentStepNumber: nextStepNumber,
          completedAt: nextStatus !== 'IN_PROGRESS' ? new Date() : null,
        },
      });

      await this.auditService.log({
        entityType: 'WorkflowInstance',
        entityId: instanceId,
        action: 'UPDATE',
        oldValues: { status: instance.status, currentStepNumber: instance.currentStepNumber },
        newValues: { status: nextStatus, currentStepNumber: nextStepNumber, action, remarks },
        changedBy: actionBy,
      });

      return updatedInstance;
    });
  }

  async getInstanceHistory(instanceId: string) {
    const instance = await this.prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflowDefinition: true,
        stepAssignments: { include: { workflowStep: true } },
        stepHistories: {
          include: { workflowStep: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!instance) throw new NotFoundException(`Workflow instance ${instanceId} not found`);
    return instance;
  }

  async getPendingAssignments(userId: string, pagination: any) {
    const where = {
      assignedTo: userId,
      status: 'PENDING' as any,
    };
    const { skip, take } = getPaginationParams(pagination);

    const [items, totalCount] = await Promise.all([
      this.prisma.workflowStepAssignment.findMany({
        where,
        include: {
          workflowInstance: {
            include: { workflowDefinition: true },
          },
          workflowStep: true,
        },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflowStepAssignment.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, pagination.page || 1, pagination.pageSize || 50);
  }
}
