// src/profile/profile.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        branchAccesses: { include: { branch: true } },
      },
    });

    if (!user) throw new NotFoundException(`User ${userId} not found`);

    const { passwordHash, refreshToken, ...profile } = user;
    const roleNames = user.roles.map((ur) => ur.role?.name || '');
    const isSuper = roleNames.some((r) => r.toUpperCase().includes('SUPER') || r.toUpperCase().includes('ADMIN')) || user.username.toLowerCase() === 'admin';
    const firstBranch = user.branchAccesses[0];
    const branchIncharge = isSuper ? null : (firstBranch?.branch?.incharge || null);
    const branchName = isSuper ? 'All Branches' : (firstBranch?.branch?.name || null);

    return {
      ...profile,
      fullName: (!isSuper && branchIncharge) ? branchIncharge : profile.fullName,
      branchCode: isSuper ? null : (firstBranch?.branchCode || null),
      branchName: branchName,
      incharge: branchIncharge,
    };
  }

  async updateProfile(userId: string, data: { fullName?: string; email?: string; phone?: string }) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        updatedBy: userId,
      },
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE',
      newValues: { fullName: updated.fullName, email: updated.email, phone: updated.phone },
      changedBy: userId,
    });

    const { passwordHash, refreshToken, ...result } = updated;
    return result;
  }

  async changePassword(userId: string, data: { oldPassword?: string; newPassword?: string }) {
    if (!data.oldPassword || !data.newPassword) {
      throw new BadRequestException('Both oldPassword and newPassword are required.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(data.oldPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(data.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash, updatedBy: userId },
    });

    await this.auditService.log({
      entityType: 'User',
      entityId: userId,
      action: 'UPDATE',
      newValues: { passwordChanged: true },
      changedBy: userId,
    });

    return { message: 'Password updated successfully' };
  }

  async updateNotificationPreferences(userId: string, prefs: Array<{ channel: any; isEnabled: boolean }>) {
    return [];
  }
}
