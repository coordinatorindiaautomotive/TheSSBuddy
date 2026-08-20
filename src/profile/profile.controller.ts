// src/profile/profile.controller.ts
import {
  Controller,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MessageChannel } from '@prisma/client';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile details' })
  async getProfile(@Req() req: any) {
    return this.profileService.getProfile(req.user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update profile info (fullName, email, phone)' })
  async updateProfile(
    @Body() body: { fullName?: string; email?: string; phone?: string },
    @Req() req: any,
  ) {
    return this.profileService.updateProfile(req.user.id, body);
  }

  @Put('password')
  @ApiOperation({ summary: 'Change password with current password verification' })
  async changePassword(
    @Body() body: { oldPassword?: string; newPassword?: string },
    @Req() req: any,
  ) {
    return this.profileService.changePassword(req.user.id, body);
  }

  @Put('notification-preferences')
  @ApiOperation({ summary: 'Update user notification channel preferences' })
  async updateNotificationPreferences(
    @Body() body: { preferences: Array<{ channel: MessageChannel; isEnabled: boolean }> },
    @Req() req: any,
  ) {
    return this.profileService.updateNotificationPreferences(req.user.id, body.preferences || []);
  }
}
