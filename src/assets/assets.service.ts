// src/assets/assets.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

const DEFAULT_ASSET_CATEGORIES = [
  { code: 'LAPTOP', name: 'Laptops & Workstations', description: 'Desktops, Laptops, MacBooks, and Workstations' },
  { code: 'PRINTER', name: 'Printers & Scanners', description: 'Thermal barcode printers, LaserJet printers, and flatbed scanners' },
  { code: 'NETWORK', name: 'Networking Equipment', description: 'Routers, Switches, Access Points, and Firewalls' },
  { code: 'SERVER', name: 'Servers & Storage', description: 'On-premise servers, NAS devices, and SAN arrays' },
  { code: 'MOBILE', name: 'Mobile & Handheld Devices', description: 'Tablets, Handheld Stock Terminals, and Mobile Phones' },
  { code: 'FURNITURE', name: 'Office Furniture & Fixtures', description: 'Desks, Chairs, Filing Cabinets, and Executive Tables' },
];

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  // ─── 1. CATEGORY MANAGEMENT ──────────────────────────────────────────────────
  async getCategories() {
    return DEFAULT_ASSET_CATEGORIES;
  }

  async createOrUpdateCategory(dto: { id?: string; code: string; name: string; description?: string; icon?: string; color?: string; isActive?: boolean }) {
    return { code: dto.code, name: dto.name, description: dto.description || '' };
  }

  async deleteCategory(id: string) {
    return { success: true };
  }

  // ─── 2. ASSET MANAGEMENT ──────────────────────────────────────────────────────
  async getAssets(category?: string, branchCode?: string, status?: string, search?: string) {
    const where: any = {};
    if (category && category !== 'ALL') where.category = category;
    if (branchCode && branchCode !== 'ALL') where.allocatedToBranch = branchCode;
    if (status && status !== 'ALL') where.status = status;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { vendorName: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const assets = await this.prisma.asset.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    const enriched = assets.map((a: any) => ({
      ...a,
      allocatedToUserName: 'N/A',
      allocatedToBranchName: a.allocatedToBranch || 'Unassigned',
      allocations: [],
      maintenanceLogs: [],
    }));

    const totalCount = assets.length;
    const availableCount = assets.filter((a: any) => a.status === 'AVAILABLE').length;
    const allocatedCount = assets.filter((a: any) => a.status === 'ALLOCATED').length;
    const maintenanceCount = assets.filter((a: any) => a.status === 'MAINTENANCE').length;
    const totalCost = assets.reduce((sum: number, a: any) => sum + (Number(a.depreciationRate) || 0), 0);

    return {
      assets: enriched,
      categories: DEFAULT_ASSET_CATEGORIES,
      metrics: {
        totalCount,
        availableCount,
        allocatedCount,
        maintenanceCount,
        totalCost,
      },
    };
  }

  async getAssetById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
    });
    if (!asset) throw new NotFoundException('Asset not found.');

    return {
      ...asset,
      allocatedToUserName: 'N/A',
      allocatedToBranchName: asset.allocatedToBranch || 'Unassigned',
      allocations: [],
      maintenanceLogs: [],
    };
  }

  async createAsset(dto: any, userId: string) {
    if (!dto.code || !dto.name || !dto.category) {
      throw new BadRequestException('Asset code, name, and category are required.');
    }

    const existing = await this.prisma.asset.findUnique({ where: { code: dto.code.trim() } });
    if (existing) throw new BadRequestException(`Asset with code '${dto.code}' already exists.`);

    const created = await this.prisma.asset.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        category: dto.category,
        status: dto.status || 'AVAILABLE',
        allocatedToUser: dto.allocatedToUser || null,
        allocatedToBranch: dto.allocatedToBranch || null,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : null,
        amcExpiry: dto.amcExpiry ? new Date(dto.amcExpiry) : null,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : null,
        barcode: dto.barcode || null,
        qrCode: dto.qrCode || null,
        depreciationRate: dto.depreciationRate ? parseFloat(dto.depreciationRate) : 0,
        vendorName: dto.vendorName || null,
      },
    });

    await this.auditService.log({
      entityType: 'Asset',
      entityId: created.id,
      action: 'CREATE',
      newValues: created,
      changedBy: userId,
    });

    return created;
  }

  async updateAsset(id: string, dto: any, userId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : asset.name,
        category: dto.category || asset.category,
        status: dto.status || asset.status,
        allocatedToUser: dto.allocatedToUser !== undefined ? dto.allocatedToUser : asset.allocatedToUser,
        allocatedToBranch: dto.allocatedToBranch !== undefined ? dto.allocatedToBranch : asset.allocatedToBranch,
        warrantyExpiry: dto.warrantyExpiry ? new Date(dto.warrantyExpiry) : asset.warrantyExpiry,
        amcExpiry: dto.amcExpiry ? new Date(dto.amcExpiry) : asset.amcExpiry,
        insuranceExpiry: dto.insuranceExpiry ? new Date(dto.insuranceExpiry) : asset.insuranceExpiry,
        barcode: dto.barcode !== undefined ? dto.barcode : asset.barcode,
        qrCode: dto.qrCode !== undefined ? dto.qrCode : asset.qrCode,
        depreciationRate: dto.depreciationRate !== undefined ? parseFloat(dto.depreciationRate) : asset.depreciationRate,
        vendorName: dto.vendorName !== undefined ? dto.vendorName : asset.vendorName,
      },
    });

    await this.auditService.log({
      entityType: 'Asset',
      entityId: id,
      action: 'UPDATE',
      oldValues: asset,
      newValues: updated,
      changedBy: userId,
    });

    return updated;
  }

  async allocateAsset(id: string, dto: { userId?: string; branchCode?: string; remarks?: string }, actionByUserId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        status: 'ALLOCATED',
        allocatedToUser: dto.userId || null,
        allocatedToBranch: dto.branchCode || null,
      },
    });

    return updated;
  }

  async logMaintenance(id: string, dto: { type: string; description: string; cost?: number }, actionByUserId: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    await this.prisma.asset.update({
      where: { id },
      data: { status: 'MAINTENANCE' },
    });

    return { assetId: id, type: dto.type, description: dto.description, cost: dto.cost || 0 };
  }

  async deleteAsset(id: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    return this.prisma.asset.delete({ where: { id } });
  }
}
