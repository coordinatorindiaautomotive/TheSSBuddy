// src/notifications/notifications.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Queue } from 'bullmq';
import { BULK_MESSAGE_QUEUE } from '../bullmq/bullmq.module';
import { EmailChannelProvider, SmsMsg91Provider, MockChannelProvider, MessageChannelProvider } from './channel-providers';
import { MessageChannel, NotificationType } from '@prisma/client';
import { getPaginationParams, buildPaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private providers: Map<MessageChannel, MessageChannelProvider> = new Map();

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(BULK_MESSAGE_QUEUE) private readonly bulkMsgQueue: Queue,
  ) {
    this.providers.set(MessageChannel.EMAIL, new EmailChannelProvider());
    this.providers.set(MessageChannel.SMS, new SmsMsg91Provider());
    this.providers.set(MessageChannel.IN_APP, new MockChannelProvider());
  }

  async createTemplate(data: any, createdBy: string) {
    const template = await this.prisma.messageTemplate.create({
      data: {
        code: data.code,
        name: data.name,
        channel: data.channel,
        subject: data.subject || null,
        body: data.body,
        mergeFields: data.mergeFields || null,
        isActive: data.isActive ?? true,
        createdBy,
      },
    });

    await this.auditService.log({
      entityType: 'MessageTemplate',
      entityId: template.id,
      action: 'CREATE',
      newValues: template,
      changedBy: createdBy,
    });

    return template;
  }

  async getTemplates(filter: any) {
    const where: any = {};
    if (filter.channel) where.channel = filter.channel;
    if (filter.isActive !== undefined) where.isActive = filter.isActive === 'true' || filter.isActive === true;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.messageTemplate.findMany({
        where,
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async previewTemplate(templateCode: string, partyId: string) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { code: templateCode } });
    if (!template) throw new NotFoundException(`Message template ${templateCode} not found`);

    const party = await this.prisma.party.findUnique({ where: { id: partyId } });
    if (!party) throw new NotFoundException(`Party ${partyId} not found`);

    const mergeValues: Record<string, string> = {
      partyName: party.name,
      partyCode: party.code,
      partyType: party.type,
      email: party.email || 'N/A',
      phone: party.phone || 'N/A',
      branchCode: party.primaryBranchCode || 'HEAD',
      currentDate: new Date().toISOString().split('T')[0],
    };

    let renderedSubject = template.subject || '';
    let renderedBody = template.body;

    for (const [key, val] of Object.entries(mergeValues)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      renderedSubject = renderedSubject.replace(regex, val);
      renderedBody = renderedBody.replace(regex, val);
    }

    return {
      templateCode,
      partyId,
      renderedSubject,
      renderedBody,
      mergeValues,
    };
  }

  async sendMessage(
    channel: MessageChannel,
    recipientAddr: string,
    body: string,
    subject?: string,
    templateId?: string,
    recipientId?: string,
    sentById?: string,
  ) {
    const provider = this.providers.get(channel) || this.providers.get(MessageChannel.IN_APP)!;
    const res = await provider.send({ recipientAddr, subject, body });

    const log = await this.prisma.messageLog.create({
      data: {
        templateId: templateId || null,
        channel,
        recipientId: recipientId || null,
        recipientAddr,
        subject: subject || null,
        body,
        status: res.success ? 'SENT' : 'FAILED',
        errorMessage: res.error || null,
        sentAt: res.success ? new Date() : null,
        providerRef: res.providerRef || null,
        sentById: sentById || null,
        createdBy: sentById || null,
      },
    });

    return log;
  }

  async enqueueBulkSend(templateCode: string, partyIds: string[], sentById: string) {
    const template = await this.prisma.messageTemplate.findUnique({ where: { code: templateCode } });
    if (!template) throw new NotFoundException(`Message template ${templateCode} not found`);

    const job = await this.bulkMsgQueue.add('bulk-send-job', {
      templateCode,
      partyIds,
      sentById,
    });

    return {
      jobId: job.id,
      status: 'QUEUED',
      totalRecipients: partyIds.length,
    };
  }

  async getMessageLogs(filter: any) {
    const where: any = {};
    if (filter.channel) where.channel = filter.channel;
    if (filter.status) where.status = filter.status;
    if (filter.recipientId) where.recipientId = filter.recipientId;

    const { skip, take } = getPaginationParams(filter);
    const [items, totalCount] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        include: { template: true, sender: { select: { id: true, fullName: true } } },
        skip, take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    return buildPaginatedResponse(items, totalCount, filter.page || 1, filter.pageSize || 50);
  }

  async createAnnouncement(data: any, createdBy: string) {
    const announcement = await this.prisma.announcement.create({
      data: {
        title: data.title,
        body: data.body,
        scope: data.scope || 'ALL',
        branchCode: data.branchCode || null,
        roleIds: data.roleIds || null,
        userIds: data.userIds || null,
        isActive: data.isActive ?? true,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        createdBy,
      },
    });

    return announcement;
  }

  async getAnnouncements(userId: string) {
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { startsAt: null },
          { startsAt: { lte: new Date() } },
        ],
        AND: [
          {
            OR: [
              { endsAt: null },
              { endsAt: { gte: new Date() } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserInbox(userId: string) {
    const [announcements, notifications] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.notification.findMany({
        where: userId ? { userId, status: 'UNREAD' } : { status: 'UNREAD' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return {
      announcements,
      notifications,
      totalUnread: notifications.length + announcements.length,
    };
  }

  async markNotificationRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: 'READ' },
    });
  }

  async clearAllNotifications(userId: string) {
    await Promise.all([
      this.prisma.notification.deleteMany({
        where: userId ? { userId } : {},
      }),
      this.prisma.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
    ]);
    return { ok: true, message: 'All notifications cleared.' };
  }

  async dismissNotification(id: string, isAnnouncement: boolean, userId: string) {
    if (isAnnouncement) {
      await this.prisma.announcement.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      await this.prisma.notification.deleteMany({
        where: { id },
      });
    }
    return { ok: true, message: 'Notification dismissed.' };
  }

  async getHelpTexts(section?: string) {
    return [];
  }
}
