// src/helpdesk/helpdesk.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

const DEFAULT_HELPDESK_CATEGORIES = [
  { code: 'INCENTIVE_QUERY', name: 'Incentive & Commission Calculations', description: 'Discrepancies in slab calculations, payouts, or targets', priority: 'HIGH' },
  { code: 'SALES_DATA_SYNC', name: 'Sales Upload & Raw Data Sync', description: 'Retail sales record omissions, batch upload failures, or EDI discrepancies', priority: 'HIGH' },
  { code: 'PAYMENT_LEDGER', name: 'Payment, Ledger & Outstanding', description: 'Statement of accounts, debit/credit notes, or payment adjustments', priority: 'MEDIUM' },
  { code: 'HARDWARE_IT', name: 'Hardware & IT Equipment', description: 'Laptops, printers, workstation issues, and barcode scanners', priority: 'MEDIUM' },
  { code: 'SOFTWARE_ACCESS', name: 'Software, ERP & Access Control', description: 'Login issues, password resets, and module permission changes', priority: 'HIGH' },
  { code: 'GENERAL_INQUIRY', name: 'General Inquiries', description: 'Miscellaneous corporate operations and branch support', priority: 'LOW' },
];

@Injectable()
export class HelpdeskService {
  private readonly logger = new Logger(HelpdeskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  // ─── 1. DYNAMIC CATEGORY MANAGEMENT ──────────────────────────────────────────
  async getCategories() {
    return DEFAULT_HELPDESK_CATEGORIES;
  }

  async createOrUpdateCategory(dto: { id?: string; code: string; name: string; description?: string; priority?: string; isActive?: boolean }) {
    return { code: dto.code, name: dto.name, description: dto.description || '', priority: dto.priority || 'MEDIUM' };
  }

  async deleteCategory(id: string) {
    return { success: true };
  }

  // ─── 2. TICKET MANAGEMENT ───────────────────────────────────────────────────
  async getTickets(category?: string, priority?: string, status?: string, search?: string) {
    const where: any = {};
    if (category && category !== 'ALL') where.category = category;
    if (priority && priority !== 'ALL') where.priority = priority;
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { ticketNo: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const tickets = await this.prisma.helpDeskTicket.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    const userIds = Array.from(new Set(tickets.map(t => t.createdBy).filter(Boolean)));
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, fullName: true, username: true },
    });
    const userMap = new Map<string, string>();
    users.forEach(u => userMap.set(u.id, u.fullName || u.username));

    const enriched = tickets.map(t => ({
      ...t,
      createdByName: userMap.get(t.createdBy) || 'User',
      comments: [],
    }));

    const totalCount = tickets.length;
    const openCount = tickets.filter((t: any) => t.status === 'OPEN').length;
    const inProgressCount = tickets.filter((t: any) => t.status === 'IN_PROGRESS').length;
    const resolvedCount = tickets.filter((t: any) => t.status === 'RESOLVED' || t.status === 'CLOSED').length;
    const urgentCount = tickets.filter((t: any) => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;

    return {
      tickets: enriched,
      categories: DEFAULT_HELPDESK_CATEGORIES,
      metrics: {
        totalCount,
        openCount,
        inProgressCount,
        resolvedCount,
        urgentCount,
      },
    };
  }

  async getTicketById(id: string) {
    const ticket = await this.prisma.helpDeskTicket.findUnique({
      where: { id },
    });
    if (!ticket) throw new NotFoundException('Help Desk Ticket not found.');

    const user = await this.prisma.user.findUnique({
      where: { id: ticket.createdBy },
      select: { fullName: true, username: true, email: true },
    });

    return {
      ...ticket,
      createdByName: user ? (user.fullName || user.username) : 'User',
      comments: [],
    };
  }

  async createTicket(dto: any, userId: string) {
    if (!dto.title || !dto.category) {
      throw new BadRequestException('Ticket title and category are required.');
    }

    const count = await this.prisma.helpDeskTicket.count();
    const ticketNo = `TKT-${(1001 + count).toString()}`;

    const created = await this.prisma.helpDeskTicket.create({
      data: {
        ticketNo,
        title: dto.title.trim(),
        category: dto.category,
        priority: dto.priority || 'MEDIUM',
        description: dto.description || '',
        status: 'OPEN',
        createdBy: userId || '00000000-0000-0000-0000-000000000000',
      },
    });

    await this.auditService.log({
      entityType: 'HelpDeskTicket',
      entityId: created.id,
      action: 'CREATE',
      newValues: created,
      changedBy: userId,
    });

    return created;
  }

  async updateTicketStatus(id: string, status: string, assignedToUserId?: string, userId?: string) {
    const ticket = await this.prisma.helpDeskTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Help Desk Ticket not found.');

    const updated = await this.prisma.helpDeskTicket.update({
      where: { id },
      data: {
        status,
        assignedTo: assignedToUserId || ticket.assignedTo,
      },
    });

    await this.auditService.log({
      entityType: 'HelpDeskTicket',
      entityId: id,
      action: 'UPDATE',
      oldValues: { status: ticket.status },
      newValues: { status: updated.status },
      changedBy: userId,
    });

    return updated;
  }

  async addComment(ticketId: string, commentText: string, userId: string) {
    return { ticketId, userId, comment: commentText, createdAt: new Date() };
  }

  async deleteTicket(id: string) {
    const ticket = await this.prisma.helpDeskTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    return this.prisma.helpDeskTicket.delete({ where: { id } });
  }
}
