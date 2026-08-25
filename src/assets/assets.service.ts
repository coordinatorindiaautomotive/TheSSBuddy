// src/assets/assets.service.ts
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BranchIsolationService } from '../branch-isolation/branch-isolation.service';

const INITIAL_CATEGORIES = [
  { code: 'LAPTOP', name: 'Laptops & Workstations', description: 'Desktops, Laptops, MacBooks, and Workstations', icon: 'Laptop', color: '#2563eb', sortOrder: 1 },
  { code: 'PRINTER', name: 'Printers & Scanners', description: 'Thermal barcode printers, LaserJet printers, and flatbed scanners', icon: 'Printer', color: '#087443', sortOrder: 2 },
  { code: 'NETWORK', name: 'Networking & WiFi', description: 'Routers, Switches, Access Points, and Firewalls', icon: 'Wifi', color: '#7c3aed', sortOrder: 3 },
  { code: 'SERVER', name: 'Servers & Storage', description: 'On-premise servers, NAS devices, and SAN arrays', icon: 'Server', color: '#053D3A', sortOrder: 4 },
  { code: 'MOBILE', name: 'Mobile & Handhelds', description: 'Tablets, Handheld Stock Terminals, and Mobile Phones', icon: 'Smartphone', color: '#d97706', sortOrder: 5 },
  { code: 'FURNITURE', name: 'Office Furniture', description: 'Desks, Chairs, Filing Cabinets, and Executive Tables', icon: 'Armchair', color: '#4b5563', sortOrder: 6 },
  { code: 'VEHICLE', name: 'Company Vehicles', description: 'Logistics vans, two-wheelers, and executive cars', icon: 'Car', color: '#0284c7', sortOrder: 7 },
  { code: 'SOFTWARE', name: 'Software & Licenses', description: 'Operating systems, ERP licenses, and productivity suites', icon: 'Code', color: '#dc2626', sortOrder: 8 },
  { code: 'CCTV', name: 'Security & Surveillance', description: 'CCTV cameras, NVRs, DVRs, and biometric machines', icon: 'Shield', color: '#0d9488', sortOrder: 9 },
  { code: 'OTHER', name: 'General Capital Assets', description: 'Miscellaneous office equipment and appliances', icon: 'Boxes', color: '#64748b', sortOrder: 10 },
];

@Injectable()
export class AssetsService {
  private readonly logger = new Logger(AssetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly branchIsolation: BranchIsolationService,
  ) {}

  // ─── 1. CATEGORY MANAGEMENT (100% DB PERSISTED) ─────────────────────────────
  async ensureSeedCategories() {
    try {
      const count = await this.prisma.assetCategory.count();
      if (count === 0) {
        this.logger.log('Seeding initial asset categories into PostgreSQL...');
        for (const cat of INITIAL_CATEGORIES) {
          await this.prisma.assetCategory.upsert({
            where: { code: cat.code },
            create: {
              code: cat.code,
              name: cat.name,
              description: cat.description,
              icon: cat.icon,
              color: cat.color,
              sortOrder: cat.sortOrder,
              isActive: true,
            },
            update: {},
          });
        }
      }
    } catch (err) {
      this.logger.error('Error seeding asset categories:', err);
    }
  }

  async getCategories() {
    await this.ensureSeedCategories();

    const categories = await this.prisma.assetCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    // Compute live asset count per category
    const assetCounts = await this.prisma.asset.groupBy({
      by: ['category'],
      _count: { id: true },
    });
    const countMap = new Map<string, number>();
    assetCounts.forEach((ac) => {
      countMap.set(ac.category.toUpperCase(), ac._count.id);
    });

    return categories.map((cat) => ({
      ...cat,
      assetCount: countMap.get(cat.code.toUpperCase()) || 0,
    }));
  }

  async createOrUpdateCategory(dto: {
    id?: string;
    code: string;
    name: string;
    description?: string;
    icon?: string;
    color?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    if (!dto.code || !dto.name) {
      throw new BadRequestException('Category code and name are required.');
    }

    const cleanCode = dto.code.trim().toUpperCase();
    const cleanName = dto.name.trim();

    if (dto.id) {
      // Update by ID
      const updated = await this.prisma.assetCategory.update({
        where: { id: dto.id },
        data: {
          code: cleanCode,
          name: cleanName,
          description: dto.description?.trim() || null,
          icon: dto.icon || 'Boxes',
          color: dto.color || '#053D3A',
          sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : 0,
          isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
        },
      });
      return updated;
    }

    // Create or Upsert by Code
    const created = await this.prisma.assetCategory.upsert({
      where: { code: cleanCode },
      create: {
        code: cleanCode,
        name: cleanName,
        description: dto.description?.trim() || null,
        icon: dto.icon || 'Boxes',
        color: dto.color || '#053D3A',
        sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : 0,
        isActive: true,
      },
      update: {
        name: cleanName,
        description: dto.description?.trim() || null,
        icon: dto.icon || 'Boxes',
        color: dto.color || '#053D3A',
        sortOrder: dto.sortOrder !== undefined ? Number(dto.sortOrder) : 0,
        isActive: dto.isActive !== undefined ? Boolean(dto.isActive) : true,
      },
    });

    return created;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.assetCategory.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found.');
    }

    // Check if any assets are assigned to this category
    const linkedAssetsCount = await this.prisma.asset.count({
      where: { category: category.code },
    });

    if (linkedAssetsCount > 0) {
      // Soft-delete to preserve data integrity
      await this.prisma.assetCategory.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        success: true,
        message: `Category deactivated (contains ${linkedAssetsCount} linked assets).`,
      };
    }

    await this.prisma.assetCategory.delete({ where: { id } });
    return { success: true, message: 'Category deleted successfully.' };
  }

  // ─── 2. ENTERPRISE ASSET MANAGEMENT ──────────────────────────────────────────
  async getAssets(category?: string, status?: string, branchCode?: string, search?: string) {
    await this.ensureSeedCategories();

    const where: any = {};

    // Branch Isolation
    if (branchCode && branchCode !== 'ALL') {
      where.allocatedToBranch = branchCode;
    } else {
      this.branchIsolation.mergeBranchFilter(where, 'allocatedToBranch');
    }

    if (category && category !== 'ALL') {
      where.category = category.toUpperCase();
    }

    if (status && status !== 'ALL') {
      where.status = status.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { serialNumber: { contains: q, mode: 'insensitive' } },
        { modelNumber: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { allocatedToUserName: { contains: q, mode: 'insensitive' } },
        { allocatedToBranch: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [assets, categories, branches] = await Promise.all([
      this.prisma.asset.findMany({
        where,
        include: {
          allocations: {
            orderBy: { allocatedAt: 'desc' },
            take: 3,
          },
          maintenanceLogs: {
            orderBy: { serviceDate: 'desc' },
            take: 3,
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.getCategories(),
      this.prisma.branch.findMany({
        select: { code: true, name: true, region: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    // Financial & Operational Metrics
    const totalCount = assets.length;
    const availableCount = assets.filter((a) => a.status === 'AVAILABLE').length;
    const allocatedCount = assets.filter((a) => a.status === 'ALLOCATED').length;
    const maintenanceCount = assets.filter((a) => a.status === 'MAINTENANCE').length;
    const disposedCount = assets.filter((a) => a.status === 'DISPOSED').length;

    const totalPurchaseCost = assets.reduce((sum, a) => sum + (Number(a.purchaseCost) || 0), 0);
    const totalCurrentValuation = assets.reduce(
      (sum, a) => sum + (Number(a.currentValue) || Number(a.purchaseCost) || 0),
      0
    );

    return {
      assets,
      categories,
      branches,
      metrics: {
        totalCount,
        availableCount,
        allocatedCount,
        maintenanceCount,
        disposedCount,
        totalPurchaseCost,
        totalCurrentValuation,
      },
    };
  }

  async getAssetById(id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id },
      include: {
        allocations: { orderBy: { allocatedAt: 'desc' } },
        maintenanceLogs: { orderBy: { serviceDate: 'desc' } },
      },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    return asset;
  }

  async createAsset(dto: any, userId?: string) {
    if (!dto.code || !dto.name || !dto.category) {
      throw new BadRequestException('Asset Code, Name, and Category are required.');
    }

    const cleanStr = (val: any) => {
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      return s.length === 0 ? null : s;
    };

    const cleanDate = (val: any) => {
      if (!val || val === '' || val === 'null') return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const cleanNum = (val: any, fallback = 0) => {
      if (val === undefined || val === null || val === '') return fallback;
      const n = Number(val);
      return isNaN(n) ? fallback : n;
    };

    const cleanCode = cleanStr(dto.code)?.toUpperCase() || '';
    const existing = await this.prisma.asset.findUnique({ where: { code: cleanCode } });
    if (existing) {
      throw new BadRequestException(`Asset with code '${cleanCode}' already exists.`);
    }

    const purchaseCost = cleanNum(dto.purchaseCost, 0);
    const depreciationRate = cleanNum(dto.depreciationRate, 0);
    const currentValue = dto.currentValue !== undefined
      ? cleanNum(dto.currentValue, purchaseCost)
      : purchaseCost;

    const status = cleanStr(dto.status) || (cleanStr(dto.allocatedToBranch) || cleanStr(dto.allocatedToUser) ? 'ALLOCATED' : 'AVAILABLE');

    const created = await this.prisma.asset.create({
      data: {
        code: cleanCode,
        name: cleanStr(dto.name) || '',
        category: cleanStr(dto.category)?.toUpperCase() || '',
        status,
        serialNumber: cleanStr(dto.serialNumber),
        modelNumber: cleanStr(dto.modelNumber),
        specifications: cleanStr(dto.specifications),
        purchaseDate: cleanDate(dto.purchaseDate),
        purchaseCost,
        currentValue,
        billNumber: cleanStr(dto.billNumber),
        vendorName: cleanStr(dto.vendorName),
        allocatedToBranch: cleanStr(dto.allocatedToBranch),
        allocatedToUser: cleanStr(dto.allocatedToUser),
        allocatedToUserName: cleanStr(dto.allocatedToUserName),
        warrantyExpiry: cleanDate(dto.warrantyExpiry),
        amcExpiry: cleanDate(dto.amcExpiry),
        insuranceExpiry: cleanDate(dto.insuranceExpiry),
        barcode: cleanStr(dto.barcode) || cleanCode,
        qrCode: cleanStr(dto.qrCode) || cleanCode,
        depreciationRate,
        notes: cleanStr(dto.notes),
      },
    });

    // Create initial allocation log if assigned
    if (cleanStr(dto.allocatedToBranch) || cleanStr(dto.allocatedToUser)) {
      await this.prisma.assetAllocation.create({
        data: {
          assetId: created.id,
          branchCode: cleanStr(dto.allocatedToBranch),
          userId: cleanStr(dto.allocatedToUser),
          userName: cleanStr(dto.allocatedToUserName) || 'Assigned User',
          remarks: 'Initial Allocation upon Registration',
        },
      });
    }

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: created.id,
        action: 'CREATE',
        newValues: created,
        changedBy: userId,
      });
    }

    return created;
  }

  async updateAsset(id: string, dto: any, userId?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    const cleanStr = (val: any, fallback: any = null) => {
      if (val === undefined) return fallback;
      if (val === null) return null;
      const s = String(val).trim();
      return s.length === 0 ? null : s;
    };

    const cleanDate = (val: any, fallback: any = null) => {
      if (val === undefined) return fallback;
      if (!val || val === '' || val === 'null') return null;
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    };

    const cleanNum = (val: any, fallback = 0) => {
      if (val === undefined || val === null || val === '') return fallback;
      const n = Number(val);
      return isNaN(n) ? fallback : n;
    };

    const purchaseCost = cleanNum(dto.purchaseCost, asset.purchaseCost || 0);
    const depreciationRate = cleanNum(dto.depreciationRate, asset.depreciationRate || 0);
    const currentValue = cleanNum(dto.currentValue, asset.currentValue || purchaseCost);

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        code: cleanStr(dto.code, asset.code)?.toUpperCase() || asset.code,
        name: cleanStr(dto.name, asset.name) || asset.name,
        category: cleanStr(dto.category, asset.category)?.toUpperCase() || asset.category,
        status: cleanStr(dto.status, asset.status) || asset.status,
        serialNumber: cleanStr(dto.serialNumber, asset.serialNumber),
        modelNumber: cleanStr(dto.modelNumber, asset.modelNumber),
        specifications: cleanStr(dto.specifications, asset.specifications),
        purchaseDate: cleanDate(dto.purchaseDate, asset.purchaseDate),
        purchaseCost,
        currentValue,
        billNumber: cleanStr(dto.billNumber, asset.billNumber),
        vendorName: cleanStr(dto.vendorName, asset.vendorName),
        allocatedToBranch: cleanStr(dto.allocatedToBranch, asset.allocatedToBranch),
        allocatedToUser: cleanStr(dto.allocatedToUser, asset.allocatedToUser),
        allocatedToUserName: cleanStr(dto.allocatedToUserName, asset.allocatedToUserName),
        warrantyExpiry: cleanDate(dto.warrantyExpiry, asset.warrantyExpiry),
        amcExpiry: cleanDate(dto.amcExpiry, asset.amcExpiry),
        insuranceExpiry: cleanDate(dto.insuranceExpiry, asset.insuranceExpiry),
        barcode: cleanStr(dto.barcode, asset.barcode) || asset.code,
        qrCode: cleanStr(dto.qrCode, asset.qrCode) || asset.code,
        depreciationRate,
        disposalDate: cleanDate(dto.disposalDate, asset.disposalDate),
        disposalReason: cleanStr(dto.disposalReason, asset.disposalReason),
        notes: cleanStr(dto.notes, asset.notes),
      },
    });

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: id,
        action: 'UPDATE',
        oldValues: asset,
        newValues: updated,
        changedBy: userId,
      });
    }

    return updated;
  }

  async allocateAsset(
    id: string,
    body: { branchCode?: string; userId?: string; userName?: string; remarks?: string },
    userId?: string,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        allocatedToBranch: body.branchCode || asset.allocatedToBranch,
        allocatedToUser: body.userId || null,
        allocatedToUserName: body.userName || body.userId || 'Assigned User',
        status: 'ALLOCATED',
      },
    });

    await this.prisma.assetAllocation.create({
      data: {
        assetId: id,
        branchCode: body.branchCode || asset.allocatedToBranch,
        userId: body.userId || null,
        userName: body.userName || body.userId || 'Assigned User',
        remarks: body.remarks || 'Asset Allocated / Reassigned',
      },
    });

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: id,
        action: 'UPDATE',
        newValues: { branchCode: body.branchCode, userId: body.userId, userName: body.userName, actionType: 'ALLOCATE' },
        changedBy: userId,
      });
    }

    return updated;
  }

  async returnAsset(id: string, remarks?: string, userId?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    // Update active allocation
    await this.prisma.assetAllocation.updateMany({
      where: { assetId: id, returnedAt: null },
      data: { returnedAt: new Date() },
    });

    const updated = await this.prisma.asset.update({
      where: { id },
      data: {
        allocatedToUser: null,
        allocatedToUserName: null,
        status: 'AVAILABLE',
      },
    });

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: id,
        action: 'UPDATE',
        oldValues: { remarks: remarks || 'Asset returned to storage', actionType: 'RETURN' },
        changedBy: userId,
      });
    }

    return updated;
  }

  async logMaintenance(
    id: string,
    body: { type?: string; description: string; cost?: number; vendorName?: string; performedBy?: string },
    userId?: string,
  ) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    const log = await this.prisma.assetMaintenanceLog.create({
      data: {
        assetId: id,
        type: body.type || 'REPAIR',
        description: body.description,
        cost: Number(body.cost) || 0,
        vendorName: body.vendorName || null,
        performedBy: body.performedBy || 'Technician',
      },
    });

    // Optionally set asset to MAINTENANCE if active repair
    await this.prisma.asset.update({
      where: { id },
      data: { status: 'MAINTENANCE' },
    });

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: id,
        action: 'UPDATE',
        newValues: { log, actionType: 'MAINTENANCE_LOG' },
        changedBy: userId,
      });
    }

    return log;
  }

  async deleteAsset(id: string, userId?: string) {
    const asset = await this.prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found.');

    await this.prisma.asset.delete({ where: { id } });

    if (userId) {
      await this.auditService.log({
        entityType: 'Asset',
        entityId: id,
        action: 'DELETE',
        oldValues: asset,
        changedBy: userId,
      });
    }

    return { success: true, message: 'Asset deleted successfully.' };
  }
}
