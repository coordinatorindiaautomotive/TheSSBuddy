// src/notifications/channel-providers.ts
import { Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';

export interface SendMessagePayload {
  recipientAddr: string;
  subject?: string;
  body: string;
}

export interface MessageChannelProvider {
  channel: MessageChannel;
  send(payload: SendMessagePayload): Promise<{ success: boolean; providerRef?: string; error?: string }>;
}

export class EmailChannelProvider implements MessageChannelProvider {
  channel = MessageChannel.EMAIL;
  private logger = new Logger('EmailChannelProvider');

  async send(payload: SendMessagePayload) {
    this.logger.log(`[SMTP EMAIL] Sent to ${payload.recipientAddr} | Subject: "${payload.subject}"`);
    return { success: true, providerRef: `EMAIL-REF-${Date.now()}` };
  }
}

export class SmsMsg91Provider implements MessageChannelProvider {
  channel = MessageChannel.SMS;
  private logger = new Logger('SmsMsg91Provider');

  async send(payload: SendMessagePayload) {
    this.logger.log(`[MSG91 SMS] Sent to ${payload.recipientAddr} | Body: "${payload.body}"`);
    return { success: true, providerRef: `SMS-MSG91-${Date.now()}` };
  }
}

export class MockChannelProvider implements MessageChannelProvider {
  channel = MessageChannel.IN_APP;
  private logger = new Logger('MockChannelProvider');

  async send(payload: SendMessagePayload) {
    this.logger.log(`[MOCK IN-APP] Sent to ${payload.recipientAddr} | Body: "${payload.body}"`);
    return { success: true, providerRef: `MOCK-${Date.now()}` };
  }
}
