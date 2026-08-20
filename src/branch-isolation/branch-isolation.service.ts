// src/branch-isolation/branch-isolation.service.ts
import { Injectable, Scope } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface BranchContext {
  userId: string;
  isSuperAdmin?: boolean;
  branchCodes: string[];
  defaultBranchCode?: string;
}

/**
 * Branch isolation service that provides Prisma query extensions
 * for automatic branch-level data filtering.
 */
@Injectable({ scope: Scope.REQUEST })
export class BranchIsolationService {
  private context: BranchContext | null = null;

  setContext(ctx: BranchContext): void {
    this.context = ctx;
  }

  getContext(): BranchContext | null {
    return this.context;
  }

  isSuperAdmin(): boolean {
    return Boolean(this.context?.isSuperAdmin);
  }

  /**
   * Returns a Prisma `where` clause fragment that filters by accessible branches.
   * @param fieldName - The branch field name on the model (default: 'branchCode')
   */
  getBranchFilter(fieldName: string = 'branchCode'): Prisma.StringNullableFilter {
    if (!this.context || this.context.isSuperAdmin || this.context.branchCodes.length === 0) {
      return {};
    }

    if (this.context.branchCodes.length === 1) {
      return { [fieldName]: this.context.branchCodes[0] } as any;
    }

    return {
      [fieldName]: { in: this.context.branchCodes },
    } as any;
  }

  /**
   * Merges branch filter into an existing where clause with strict isolation.
   */
  mergeBranchFilter(
    existingWhere: Record<string, any>,
    fieldName: string = 'branchCode',
    requestedBranch?: string,
  ): Record<string, any> {
    // 1. SuperAdmin / Global Viewers: Can view all or specific requested branch
    if (this.context?.isSuperAdmin || !this.context || this.context.branchCodes.length === 0) {
      if (requestedBranch && requestedBranch !== 'ALL') {
        existingWhere[fieldName] = requestedBranch;
      }
      return existingWhere;
    }

    // 2. Branch-Isolated Users: Locked STRICTLY to their accessible branches
    if (requestedBranch && requestedBranch !== 'ALL') {
      if (this.context.branchCodes.includes(requestedBranch)) {
        existingWhere[fieldName] = requestedBranch;
      } else {
        // User requested a branch they have no access to -> fallback to assigned branches
        existingWhere[fieldName] = this.context.branchCodes.length === 1
          ? this.context.branchCodes[0]
          : { in: this.context.branchCodes };
      }
    } else {
      // User did not filter, or requested 'ALL' -> restrict to only their assigned branches
      existingWhere[fieldName] = this.context.branchCodes.length === 1
        ? this.context.branchCodes[0]
        : { in: this.context.branchCodes };
    }

    return existingWhere;
  }

  /**
   * Returns true if the user has access to a specific branch.
   */
  hasBranchAccess(branchCode: string): boolean {
    if (!this.context) return false;
    if (this.context.isSuperAdmin) return true;
    return this.context.branchCodes.includes(branchCode);
  }

  /**
   * Validates that a given branchCode is within the user's accessible branches.
   * Throws if not.
   */
  validateBranchAccess(branchCode: string): void {
    if (!this.hasBranchAccess(branchCode)) {
      throw new Error(
        `Access denied: user does not have access to branch ${branchCode}`,
      );
    }
  }

  /**
   * Returns the user's default branch code, or the first available branch.
   */
  getDefaultBranch(): string {
    if (!this.context || this.context.branchCodes.length === 0) {
      return 'ALL';
    }
    return this.context.defaultBranchCode || this.context.branchCodes[0];
  }

  /**
   * For queries on models that relate to Branch via a relation (e.g., Party.primaryBranchCode)
   */
  getRelatedBranchFilter(relationFieldName: string = 'primaryBranchCode', requestedBranch?: string): Record<string, any> {
    return this.mergeBranchFilter({}, relationFieldName, requestedBranch);
  }
}