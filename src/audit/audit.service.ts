// src/audit/audit.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Request } from 'express';

export interface AuditEntry {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  changedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // Batch buffer for high-throughput scenarios
  private buffer: AuditEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 2000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log a single audit entry (writes immediately).
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: entry.entityType,
          entityId: entry.entityId,
          action: entry.action,
          oldValues: entry.oldValues ?? undefined,
          newValues: entry.newValues ?? undefined,
          changedBy: entry.changedBy,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit log: ${error.message}`, error.stack);
      // Audit log failure should NOT break the business operation
    }
  }

  /**
   * Buffer an audit entry for batch writing.
   * Use this in high-throughput scenarios (bulk imports, batch calculations).
   */
  bufferEntry(entry: AuditEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flushBuffer();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushBuffer(), this.FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Flush buffered entries to the database.
   */
  async flushBuffer(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.buffer.length === 0) return;

    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.prisma.auditLog.createMany({
        data: entries.map((e) => ({
          entityType: e.entityType,
          entityId: e.entityId,
          action: e.action,
          oldValues: e.oldValues ?? undefined,
          newValues: e.newValues ?? undefined,
          changedBy: e.changedBy,
          ipAddress: e.ipAddress,
          userAgent: e.userAgent,
        })),
      });
    } catch (error) {
      this.logger.error(
        `Failed to flush ${entries.length} audit entries: ${error.message}`,
      );
      // Re-queue failed entries (limited retry)
      if (this.buffer.length < 500) {
        this.buffer.push(...entries);
      }
    }
  }

  /**
   * Extract user context from request for audit purposes.
   */
  static extractRequestContext(req: Request): { userId?: string; ipAddress?: string; userAgent?: string } {
    return {
      userId: (req.user as any)?.id,
      ipAddress: req.ip || req.headers['x-forwarded-for'] as string,
      userAgent: req.headers['user-agent'],
    };
  }

  /**
   * Compute diff between old and new values for UPDATE audits.
   * Only includes fields that actually changed.
   */
  static computeDiff(oldValues: Record<string, any>, newValues: Record<string, any>): {
    old: Record<string, any>;
    new: Record<string, any>;
  } {
    const old: Record<string, any> = {};
    const new_: Record<string, any> = {};

    for (const key of Object.keys(newValues)) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        old[key] = oldValues[key];
        new_[key] = newValues[key];
      }
    }

    return { old, new: new_ };
  }
}