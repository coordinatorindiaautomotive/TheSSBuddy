// src/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthResponseDto } from './dto/auth-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly rbacService: RbacService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
      include: {
        roles: { include: { role: true } },
        branchAccesses: { include: { branch: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roleNames = user.roles.map((ur) => ur.role.name);
    const isSuper = roleNames.some((r) => r.toUpperCase().includes('SUPER') || r.toUpperCase().includes('ADMIN')) || user.username.toLowerCase() === 'admin';
    const firstBranchAccess = user.branchAccesses[0];
    const defaultBranch = isSuper ? null : (firstBranchAccess?.branchCode || null);
    const branchIncharge = isSuper ? null : (firstBranchAccess?.branch?.incharge || null);
    const branchName = isSuper ? 'All Branches' : (firstBranchAccess?.branch?.name || null);

    const tokens = await this.generateTokens(user.id, user.username, roleNames);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    const refreshExpiry = new Date(
      Date.now() + this.parseDuration(this.configService.get('JWT_REFRESH_EXPIRY') || '7d'),
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExp: refreshExpiry,
      },
    });

    return {
      ...tokens,
      expiresIn: this.parseDuration(this.configService.get('JWT_ACCESS_EXPIRY') || '15m') / 1000,
      user: {
        id: user.id,
        username: user.username,
        fullName: (!isSuper && branchIncharge) ? branchIncharge : user.fullName,
        email: user.email,
        role: roleNames[0] || 'Dealer',
        roles: roleNames,
        branchCode: defaultBranch,
        branchName: branchName,
        incharge: branchIncharge,
        assignedBranches: isSuper ? [] : user.branchAccesses.map((ba) => ba.branchCode),
        defaultBranch,
      },
    };
  }

  async refreshToken(dto: RefreshTokenDto): Promise<AuthResponseDto> {
    // Find user by checking stored refresh token
    // Since we store a hash, we need to find active users and verify
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        refreshTokenExp: { gt: new Date() },
      },
      include: {
        roles: { include: { role: true } },
        branchAccesses: { where: { isDefault: true }, take: 1 },
      },
    });

    let matchedUser: typeof users[0] | null = null;
    for (const user of users) {
      if (user.refreshToken && await bcrypt.compare(dto.refreshToken, user.refreshToken)) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const roleNames = matchedUser.roles.map((ur) => ur.role.name);
    const defaultBranch = matchedUser.branchAccesses[0]?.branchCode || null;

    const tokens = await this.generateTokens(matchedUser.id, matchedUser.username, roleNames);

    // Rotate refresh token
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10);
    const refreshExpiry = new Date(
      Date.now() + this.parseDuration(this.configService.get('JWT_REFRESH_EXPIRY') || '7d'),
    );
    await this.prisma.user.update({
      where: { id: matchedUser.id },
      data: {
        refreshToken: refreshTokenHash,
        refreshTokenExp: refreshExpiry,
      },
    });

    // Invalidate permission cache (roles might have changed)
    this.rbacService.invalidateCache(matchedUser.id);

    return {
      ...tokens,
      expiresIn: this.parseDuration(this.configService.get('JWT_ACCESS_EXPIRY') || '15m') / 1000,
      user: {
        id: matchedUser.id,
        username: matchedUser.username,
        fullName: matchedUser.fullName,
        email: matchedUser.email,
        roles: roleNames,
        defaultBranch,
      },
    };
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExp: null,
      },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all sessions
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, refreshTokenExp: null },
    });
  }

  private async generateTokens(
    userId: string,
    username: string,
    roles: string[],
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload = { sub: userId, username, roles };
    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRY') || '15m',
    });

    const refreshPayload = { sub: userId, type: 'refresh' };
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRY') || '7d',
    });

    return { accessToken, refreshToken };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
    if (!match) return 0;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 'ms': return value;
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 0;
    }
  }

  async updateHeartbeat(userId: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // Non-blocking
    }
  }
}