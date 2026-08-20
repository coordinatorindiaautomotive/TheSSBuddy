// src/notifications/notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermissions } from '../rbac/permissions.decorator';
import { PaginationQueryDto } from '../pagination/pagination.dto';
import { MessageChannel } from '@prisma/client';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('templates')
  @RequirePermissions('notifications:create-template')
  @ApiOperation({ summary: 'Create message template with merge fields' })
  async createTemplate(@Body() body: any, @Req() req: any) {
    return this.notificationsService.createTemplate(body, req.user.id);
  }

  @Get('templates')
  @RequirePermissions('notifications:view')
  @ApiOperation({ summary: 'List message templates' })
  async getTemplates(@Query() query: PaginationQueryDto & { channel?: MessageChannel; isActive?: boolean }) {
    return this.notificationsService.getTemplates(query);
  }

  @Post('templates/:code/preview/:partyId')
  @RequirePermissions('notifications:view')
  @ApiOperation({ summary: 'Preview message template with rendered party merge fields' })
  async previewTemplate(
    @Param('code') code: string,
    @Param('partyId') partyId: string,
  ) {
    return this.notificationsService.previewTemplate(code, partyId);
  }

  @Post('send')
  @RequirePermissions('notifications:send')
  @ApiOperation({ summary: 'Send direct single message (Email / SMS / In-App)' })
  async sendMessage(@Body() body: any, @Req() req: any) {
    return this.notificationsService.sendMessage(
      body.channel,
      body.recipientAddr,
      body.body,
      body.subject,
      body.templateId,
      body.recipientId,
      req.user.id,
    );
  }

  @Post('bulk-send')
  @RequirePermissions('notifications:send-bulk')
  @ApiOperation({ summary: 'Enqueue async bulk message sending via BullMQ queue' })
  async enqueueBulkSend(
    @Body() body: { templateCode: string; partyIds: string[] },
    @Req() req: any,
  ) {
    return this.notificationsService.enqueueBulkSend(body.templateCode, body.partyIds, req.user.id);
  }

  @Get('logs')
  @RequirePermissions('notifications:view-logs')
  @ApiOperation({ summary: 'List message delivery audit logs (paginated)' })
  async getMessageLogs(@Query() query: PaginationQueryDto & { channel?: MessageChannel; status?: string; recipientId?: string }) {
    return this.notificationsService.getMessageLogs(query);
  }

  @Post('announcements')
  @RequirePermissions('notifications:announcement-create')
  @ApiOperation({ summary: 'Create system announcement' })
  async createAnnouncement(@Body() body: any, @Req() req: any) {
    return this.notificationsService.createAnnouncement(body, req.user.id);
  }

  @Get('announcements')
  @ApiOperation({ summary: 'Get active system announcements' })
  async getAnnouncements(@Req() req: any) {
    return this.notificationsService.getAnnouncements(req.user.id);
  }

  @Get('inbox')
  @ApiOperation({ summary: 'Get combined inbox of announcements and user notifications' })
  async getInbox(@Req() req: any) {
    return this.notificationsService.getUserInbox(req.user?.id || 'system');
  }

  @Post('clear-all')
  @ApiOperation({ summary: 'Clear all notifications and announcements' })
  async clearAll(@Req() req: any) {
    return this.notificationsService.clearAllNotifications(req.user?.id || 'system');
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss single notification or announcement' })
  async dismissNotification(
    @Param('id') id: string,
    @Body() body: { isAnnouncement?: boolean },
    @Req() req: any,
  ) {
    return this.notificationsService.dismissNotification(
      id,
      Boolean(body?.isAnnouncement),
      req.user?.id || 'system',
    );
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationsService.markNotificationRead(id, req.user?.id || 'system');
  }

  @Get('help-text')
  @ApiOperation({ summary: 'Get in-app help texts' })
  async getHelpTexts(@Query('section') section?: string) {
    return this.notificationsService.getHelpTexts(section);
  }
}
