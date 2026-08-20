// src/audit/audit.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService, AuditEntry } from './audit.service';
import { Request } from 'express';

/**
 * Interceptor that automatically creates audit log entries for
 * POST (CREATE), PUT/PATCH (UPDATE), and DELETE operations.
 *
 * Controllers that handle mutating operations should return the
 * affected entity (or { id, entityType }) in their response body
 * for the interceptor to capture.
 *
 * For more granular control, services can call AuditService.log() directly.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = request.method;
    const ctx = AuditService.extractRequestContext(request);

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((responseBody) => {
        try {
          this.createAuditEntry(request, responseBody, ctx);
        } catch (error) {
          this.logger.error(`Audit interceptor error: ${error.message}`);
        }
      }),
    );
  }

  private createAuditEntry(
    request: Request,
    responseBody: any,
    ctx: { userId?: string; ipAddress?: string; userAgent?: string },
  ): void {
    const method = request.method;
    const path = request.route?.path || request.url;

    // Determine entity type from path (e.g., /api/parties -> Party)
    const entityType = this.inferEntityType(path);
    if (!entityType) return;

    // Extract entity ID from response
    const entityId = responseBody?.id;
    if (!entityId) return;

    const action = method === 'POST' ? 'CREATE' : method === 'DELETE' ? 'DELETE' : 'UPDATE';

    const entry: AuditEntry = {
      entityType,
      entityId,
      action,
      newValues: action !== 'DELETE' ? this.sanitizeForAudit(responseBody) : null,
      oldValues: null, // Old values are best captured in the service layer
      changedBy: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    };

    // Fire and forget — don't block the response
    this.auditService.log(entry).catch(() => {});
  }

  private inferEntityType(path: string): string | null {
    const mapping: Record<string, string> = {
      '/api/parties': 'Party',
      '/api/branches': 'Branch',
      '/api/users': 'User',
      '/api/incentive-schemes': 'IncentiveScheme',
      '/api/incentive-records': 'IncentiveRecord',
      '/api/cash-transactions': 'CashTransaction',
      '/api/rules': 'RuleMaster',
      '/api/workflows': 'WorkflowDefinition',
      '/api/message-templates': 'MessageTemplate',
      '/api/announcements': 'Announcement',
    };

    for (const [prefix, type] of Object.entries(mapping)) {
      if (path.startsWith(prefix)) return type;
    }
    return null;
  }

  private sanitizeForAudit(data: any): Record<string, any> {
    const sanitized = { ...data };
    // Remove sensitive fields from audit
    delete sanitized.passwordHash;
    delete sanitized.refreshToken;
    delete sanitized.refreshTokenExp;
    return sanitized;
  }
}