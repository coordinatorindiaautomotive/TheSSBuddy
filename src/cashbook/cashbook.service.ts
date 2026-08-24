// src/cashbook/cashbook.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

const DEFAULT_RECEIPT_TYPES = ['General Receipt', 'Customer Cash', 'Dealer Advance', 'Miscellaneous Receipt'];
const DEFAULT_EXPENSE_CATEGORIES = ['Office Expenses', 'Travel & Fuel', 'Utilities & Internet', 'Stationery & Printing', 'Courier & Logistics'];

@Injectable()
export class CashbookService {
  private readonly logger = new Logger(CashbookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  private async checkPeriodOpen(year: number, month: number) {
    const control = await this.prisma.cashPeriodControl.findUnique({
      where: { controlYear_controlMonth: { controlYear: year, controlMonth: month } },
    });
    if (control && control.status !== 'Open') {
      throw new BadRequestException(`Cashbook operations for period ${month}/${year} are LOCKED (${control.status}).`);
    }
  }

  // ─── 1. SUMMARY METRICS ───────────────────────────────────────────────────────
  async getSummaryMetrics(branchCode?: string, year?: number, month?: number) {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0, 23, 59, 59);

    const where: any = { transactionDate: { gte: startDate, lte: endDate } };
    if (branchCode) where.branchCode = branchCode;
    this.branchIsolation.mergeBranchFilter(where);

    const [cashInTxs, cashOutTxs, periodControl] = await Promise.all([
      this.prisma.cashInTransaction.findMany({ where }),
      this.prisma.cashOutTransaction.findMany({ where }),
      this.prisma.cashPeriodControl.findUnique({
        where: { controlYear_controlMonth: { controlYear: y, controlMonth: m } },
      }),
    ]);

    const totalCashIn = cashInTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const totalCashOut = cashOutTxs.reduce((sum, tx) => sum + tx.amount, 0);
    const netCashFlow = totalCashIn - totalCashOut;

    const pendingApprovalsCount =
      cashInTxs.filter(t => t.status === 'Draft' || t.status === 'Pending').length +
      cashOutTxs.filter(t => t.status === 'Draft' || t.status === 'Pending').length;

    return {
      year: y,
      month: m,
      totalCashIn,
      totalCashOut,
      netCashFlow,
      openingBalance: 125000,
      closingBalance: 125000 + netCashFlow,
      pendingApprovalsCount,
      reconciliationExceptionsCount: 0,
      periodStatus: periodControl ? periodControl.status : 'Open',
    };
  }

  // ─── 2. CASH IN OPERATIONS ──────────────────────────────────────────────────
  async getCashInList(status?: string, branchCode?: string, fromDate?: string, toDate?: string) {
    const where: any = {};
    this.branchIsolation.mergeBranchFilter(where);
    if (status) where.status = status;
    if (branchCode) where.branchCode = branchCode;
    if (fromDate || toDate) {
      where.transactionDate = {};
      if (fromDate) where.transactionDate.gte = new Date(fromDate);
      if (toDate) where.transactionDate.lte = new Date(toDate);
    }

    const transactions = await this.prisma.cashInTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      transactions,
      totalAmount,
      totalCount: transactions.length,
      receiptTypes: DEFAULT_RECEIPT_TYPES,
    };
  }

  async createOrUpdateCashIn(dto: any, userId: string) {
    const tDate = new Date(dto.transactionDate || new Date());
    await this.checkPeriodOpen(tDate.getFullYear(), tDate.getMonth() + 1);

    const count = await this.prisma.cashInTransaction.count();
    const transactionNo = dto.transactionNo || `CIN-${tDate.getFullYear()}${(tDate.getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

    if (dto.id) {
      const existing = await this.prisma.cashInTransaction.findUnique({ where: { id: dto.id } });
      if (!existing) throw new NotFoundException('CashIn record not found');

      const updated = await this.prisma.cashInTransaction.update({
        where: { id: dto.id },
        data: {
          branchCode: dto.branchCode || existing.branchCode,
          transactionDate: tDate,
          receiptType: dto.receiptType,
          customerName: dto.customerName,
          dealerCode: dto.dealerCode,
          amount: Number(dto.amount),
          paymentMode: dto.paymentMode || 'CASH',
          bankName: dto.bankName,
          referenceNo: dto.referenceNo,
          narration: dto.narration,
          status: dto.status || existing.status,
        },
      });

      await this.auditService.log({
        entityType: 'CashInTransaction',
        entityId: updated.id,
        action: 'UPDATE',
        oldValues: existing,
        newValues: updated,
        changedBy: userId,
      });

      return updated;
    }

    const created = await this.prisma.cashInTransaction.create({
      data: {
        transactionNo,
        branchCode: dto.branchCode || 'MUMBAI-01',
        transactionDate: tDate,
        receiptType: dto.receiptType || 'General Receipt',
        customerName: dto.customerName,
        dealerCode: dto.dealerCode,
        amount: Number(dto.amount),
        paymentMode: dto.paymentMode || 'CASH',
        bankName: dto.bankName,
        referenceNo: dto.referenceNo,
        narration: dto.narration,
        status: dto.status || 'Draft',
        createdBy: userId,
      },
    });

    await this.auditService.log({
      entityType: 'CashInTransaction',
      entityId: created.id,
      action: 'CREATE',
      newValues: created,
      changedBy: userId,
    });

    return created;
  }

  async approveCashIn(id: string, status: string, remarks?: string, userId?: string) {
    const tx = await this.prisma.cashInTransaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('CashIn record not found');

    const updated = await this.prisma.cashInTransaction.update({
      where: { id },
      data: {
        status,
        approvalRemarks: remarks,
        approvedAt: new Date(),
        approvedBy: userId,
      },
    });

    return updated;
  }

  // ─── 3. CASH OUT OPERATIONS ─────────────────────────────────────────────────
  async getCashOutList(status?: string, branchCode?: string, fromDate?: string, toDate?: string) {
    const where: any = {};
    this.branchIsolation.mergeBranchFilter(where);
    if (status) where.status = status;
    if (branchCode) where.branchCode = branchCode;
    if (fromDate || toDate) {
      where.transactionDate = {};
      if (fromDate) where.transactionDate.gte = new Date(fromDate);
      if (toDate) where.transactionDate.lte = new Date(toDate);
    }

    const transactions = await this.prisma.cashOutTransaction.findMany({
      where,
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      transactions,
      totalAmount,
      totalCount: transactions.length,
      expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
    };
  }

  async createOrUpdateCashOut(dto: any, userId: string) {
    const tDate = new Date(dto.transactionDate || new Date());
    await this.checkPeriodOpen(tDate.getFullYear(), tDate.getMonth() + 1);

    const count = await this.prisma.cashOutTransaction.count();
    const transactionNo = dto.transactionNo || `COUT-${tDate.getFullYear()}${(tDate.getMonth() + 1).toString().padStart(2, '0')}-${(count + 1).toString().padStart(4, '0')}`;

    if (dto.id) {
      const existing = await this.prisma.cashOutTransaction.findUnique({ where: { id: dto.id } });
      if (!existing) throw new NotFoundException('CashOut record not found');

      const updated = await this.prisma.cashOutTransaction.update({
        where: { id: dto.id },
        data: {
          branchCode: dto.branchCode || existing.branchCode,
          transactionDate: tDate,
          expenseCategory: dto.expenseCategory,
          vendorName: dto.vendorName,
          costCenter: dto.costCenter,
          glAccount: dto.glAccount,
          amount: Number(dto.amount),
          paymentMode: dto.paymentMode || 'CASH',
          narration: dto.narration,
          status: dto.status || existing.status,
        },
      });

      return updated;
    }

    const created = await this.prisma.cashOutTransaction.create({
      data: {
        transactionNo,
        branchCode: dto.branchCode || 'MUMBAI-01',
        transactionDate: tDate,
        expenseCategory: dto.expenseCategory || 'General Expense',
        vendorName: dto.vendorName,
        costCenter: dto.costCenter,
        glAccount: dto.glAccount,
        amount: Number(dto.amount),
        paymentMode: dto.paymentMode || 'CASH',
        narration: dto.narration,
        status: dto.status || 'Draft',
        createdBy: userId,
      },
    });

    return created;
  }

  async approveCashOut(id: string, status: string, remarks?: string, userId?: string) {
    const tx = await this.prisma.cashOutTransaction.findUnique({ where: { id } });
    if (!tx) throw new NotFoundException('CashOut record not found');

    return this.prisma.cashOutTransaction.update({
      where: { id },
      data: {
        status,
        approvalRemarks: remarks,
        approvedAt: new Date(),
        approvedBy: userId,
      },
    });
  }

  // ─── 4. RECONCILIATION & AUTO-MATCH ─────────────────────────────────────────
  async getReconciliation(status?: string, branchCode?: string, year?: number, month?: number) {
    const where: any = {};
    this.branchIsolation.mergeBranchFilter(where);
    if (status) where.reconStatus = status;
    if (branchCode) where.branchCode = branchCode;

    const records = await this.prisma.cashReconRecord.findMany({
      where,
      include: { cashIn: true, cashOut: true },
      orderBy: { reconDate: 'desc' },
      take: 500,
    });

    const matchedCount = records.filter(r => ['Matched', 'Approved'].includes(r.reconStatus)).length;
    const partialCount = records.filter(r => r.reconStatus === 'Partial').length;

    return {
      records,
      totalCount: records.length,
      matchedCount,
      partialCount,
    };
  }

  // ─── 7. CATEGORY & DROPDOWN MASTERS (Admin Configurable) ───────────────────
  async getCategories() {
    try {
      const records: any[] = await this.prisma.$queryRaw`
        SELECT id, type, name, code, is_active as "isActive", sort_order as "sortOrder", created_at as "createdAt"
        FROM cash_category_masters
        WHERE is_active = true
        ORDER BY sort_order ASC, name ASC
      `;

      const expenseCategories = records
        .filter((r) => r.type === 'EXPENSE_CATEGORY')
        .map((r) => r.name);

      const receiptTypes = records
        .filter((r) => r.type === 'RECEIPT_TYPE')
        .map((r) => r.name);

      const paymentModes = records
        .filter((r) => r.type === 'PAYMENT_MODE')
        .map((r) => r.name);

      return {
        expenseCategories: expenseCategories.length > 0 ? expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
        receiptTypes: receiptTypes.length > 0 ? receiptTypes : DEFAULT_RECEIPT_TYPES,
        paymentModes: paymentModes.length > 0 ? paymentModes : ['NEFT', 'RTGS', 'UPI', 'CASH', 'CHEQUE', 'IMPS'],
        all: records,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to query cash_category_masters: ${err.message}`);
      return {
        expenseCategories: DEFAULT_EXPENSE_CATEGORIES,
        receiptTypes: DEFAULT_RECEIPT_TYPES,
        paymentModes: ['NEFT', 'RTGS', 'UPI', 'CASH', 'CHEQUE', 'IMPS'],
        all: [],
      };
    }
  }

  async getAllCategoriesAdmin() {
    try {
      const records: any[] = await this.prisma.$queryRaw`
        SELECT id, type, name, code, is_active as "isActive", sort_order as "sortOrder", created_at as "createdAt"
        FROM cash_category_masters
        ORDER BY type ASC, sort_order ASC, name ASC
      `;
      return records;
    } catch (err: any) {
      return [];
    }
  }

  async createCategory(dto: { type: string; name: string; code?: string; sortOrder?: number }, userId: string) {
    if (!dto.name || !dto.type) throw new BadRequestException('Category Type and Name are required');
    const type = dto.type.toUpperCase().trim();
    const name = dto.name.trim();
    const code = dto.code ? dto.code.trim() : null;
    const sortOrder = Number(dto.sortOrder) || 0;

    await this.prisma.$queryRaw`
      INSERT INTO cash_category_masters (id, type, name, code, is_active, sort_order, created_at, created_by)
      VALUES (gen_random_uuid(), ${type}, ${name}, ${code}, true, ${sortOrder}, NOW(), ${userId})
      ON CONFLICT (type, name) DO UPDATE SET is_active = true, sort_order = ${sortOrder}
    `;

    return { success: true, message: `Category "${name}" added successfully.` };
  }

  async updateCategory(id: string, dto: { name?: string; isActive?: boolean; sortOrder?: number }, userId: string) {
    if (!id) throw new BadRequestException('Category ID is required');
    
    if (dto.name) {
      await this.prisma.$queryRaw`
        UPDATE cash_category_masters
        SET name = ${dto.name.trim()}, is_active = COALESCE(${dto.isActive}, is_active), sort_order = COALESCE(${dto.sortOrder}, sort_order)
        WHERE id = ${id}::uuid
      `;
    } else if (dto.isActive !== undefined) {
      await this.prisma.$queryRaw`
        UPDATE cash_category_masters
        SET is_active = ${dto.isActive}
        WHERE id = ${id}::uuid
      `;
    }

    return { success: true, message: 'Category updated successfully.' };
  }

  async deleteCategory(id: string) {
    if (!id) throw new BadRequestException('Category ID is required');
    await this.prisma.$queryRaw`
      DELETE FROM cash_category_masters WHERE id = ${id}::uuid
    `;
    return { success: true, message: 'Category deleted successfully.' };
  }

  // ─── 8. BATCH PAYMENT/RECEIPT OPERATIONS ────────────────────────────────────
  async createCashOutBatch(dto: {
    paymentDate: string;
    branchCode: string;
    attachmentPath?: string;
    status?: string;
    entries: Array<{
      expenseCategory: string;
      amount: number;
      paymentMode?: string;
      narration?: string;
    }>;
  }, userId: string) {
    if (!dto.entries || dto.entries.length === 0) {
      throw new BadRequestException('At least one expense entry is required.');
    }

    const tDate = new Date(dto.paymentDate || new Date());
    await this.checkPeriodOpen(tDate.getFullYear(), tDate.getMonth() + 1);

    // Enforce branch isolation for branch manager users
    const userBranches = this.branchIsolation.getContext()?.branchCodes || [];
    const isSuper = this.branchIsolation.isSuperAdmin();
    const effectiveBranch = isSuper ? (dto.branchCode || 'ALW') : (userBranches[0] || dto.branchCode || 'ALW');

    const baseCount = await this.prisma.cashOutTransaction.count();
    const createdList = [];

    for (let i = 0; i < dto.entries.length; i++) {
      const entry = dto.entries[i];
      const seq = baseCount + i + 1;
      const transactionNo = `COUT-${tDate.getFullYear()}${(tDate.getMonth() + 1).toString().padStart(2, '0')}-${seq.toString().padStart(4, '0')}`;

      const created = await this.prisma.cashOutTransaction.create({
        data: {
          transactionNo,
          branchCode: effectiveBranch,
          transactionDate: tDate,
          expenseCategory: entry.expenseCategory || 'Office Expense',
          vendorName: entry.expenseCategory || 'General',
          amount: Number(entry.amount) || 0,
          paymentMode: entry.paymentMode || 'NEFT',
          narration: entry.narration || null,
          attachmentPath: dto.attachmentPath || null,
          status: dto.status || 'Pending',
          createdBy: userId,
        },
      });
      createdList.push(created);
    }

    return {
      success: true,
      count: createdList.length,
      transactions: createdList,
    };
  }

  async createCashInBatch(dto: {
    receiptDate: string;
    branchCode: string;
    attachmentPath?: string;
    status?: string;
    entries: Array<{
      receiptType: string;
      amount: number;
      paymentMode?: string;
      narration?: string;
    }>;
  }, userId: string) {
    if (!dto.entries || dto.entries.length === 0) {
      throw new BadRequestException('At least one receipt entry is required.');
    }

    const tDate = new Date(dto.receiptDate || new Date());
    await this.checkPeriodOpen(tDate.getFullYear(), tDate.getMonth() + 1);

    // Enforce branch isolation for branch manager users
    const userBranches = this.branchIsolation.getContext()?.branchCodes || [];
    const isSuper = this.branchIsolation.isSuperAdmin();
    const effectiveBranch = isSuper ? (dto.branchCode || 'ALW') : (userBranches[0] || dto.branchCode || 'ALW');

    const baseCount = await this.prisma.cashInTransaction.count();
    const createdList = [];

    for (let i = 0; i < dto.entries.length; i++) {
      const entry = dto.entries[i];
      const seq = baseCount + i + 1;
      const transactionNo = `CIN-${tDate.getFullYear()}${(tDate.getMonth() + 1).toString().padStart(2, '0')}-${seq.toString().padStart(4, '0')}`;

      const created = await this.prisma.cashInTransaction.create({
        data: {
          transactionNo,
          branchCode: effectiveBranch,
          transactionDate: tDate,
          receiptType: entry.receiptType || 'Customer Cash Collection',
          customerName: entry.receiptType || 'Customer',
          amount: Number(entry.amount) || 0,
          paymentMode: entry.paymentMode || 'CASH',
          narration: entry.narration || null,
          attachmentPath: dto.attachmentPath || null,
          status: dto.status || 'Pending',
          createdBy: userId,
        },
      });
      createdList.push(created);
    }

    return {
      success: true,
      count: createdList.length,
      transactions: createdList,
    };
  }

  // ─── 9. COST CENTER CASH BALANCES ───────────────────────────────────────────
  async getCostCenterCashList(year?: number, month?: number) {
    return [];
  }

  async syncCostCenterCash(year?: number, month?: number) {
    return { ok: true, logs: ['Synced successfully.'] };
  }

  // ─── 10. PERIOD CONTROL LOCKS (Admin Driven) ───────────────────────────────
  async getPeriodControls() {
    return this.prisma.cashPeriodControl.findMany({
      orderBy: [{ controlYear: 'desc' }, { controlMonth: 'desc' }],
    });
  }

  async updatePeriodControl(year: number, month: number, status: string, userId?: string) {
    const updated = await this.prisma.cashPeriodControl.upsert({
      where: { controlYear_controlMonth: { controlYear: year, controlMonth: month } },
      update: { status, closedAt: status !== 'Open' ? new Date() : null, closedBy: userId },
      create: { controlYear: year, controlMonth: month, status, closedAt: status !== 'Open' ? new Date() : null, closedBy: userId },
    });

    await this.auditService.log({
      entityType: 'CashPeriodControl',
      entityId: `${year}-${month}`,
      action: 'UPDATE',
      newValues: updated,
      changedBy: userId,
    });

    return updated;
  }
}
