import { Module } from '@nestjs/common';
import { PrismaModule } from '../../db/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { TelegramApiService } from './core/telegram-api.service';
import { TelegramSettingsService } from './settings/telegram-settings.service';
import { TelegramSettingsController } from './settings/telegram-settings.controller';
import { TelegramLinkingService } from './linking/telegram-linking.service';
import { TelegramLinkingController } from './linking/telegram-linking.controller';
import { TelegramNotificationsService } from './notifications/telegram-notifications.service';
import { TelegramNotificationsController } from './notifications/telegram-notifications.controller';
import { TelegramWebhookController } from './webhook/telegram-webhook.controller';
import { TelegramOwnerAlertsService } from './owner-alerts/telegram-owner-alerts.service';
import { TelegramCustomerBotService } from './customer-bot/telegram-customer-bot.service';
import { TelegramSchedulerService } from './scheduler/telegram-scheduler.service';
import { TelegramTemplatesService } from './templates/telegram-templates.service';
import { TelegramTemplatesController } from './templates/telegram-templates.controller';
import { TelegramInventoryAlertsService } from './inventory-alerts/telegram-inventory-alerts.service';
import { TelegramInventoryAlertsController } from './inventory-alerts/telegram-inventory-alerts.controller';
import { TelegramStaffService } from './staff/telegram-staff.service';
import { TelegramStaffController } from './staff/telegram-staff.controller';
import { TelegramCustomerApiService } from './customer-bot/telegram-customer-api.service';
import { TelegramCustomerApiController } from './customer-bot/telegram-customer-api.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    TelegramSettingsController,
    TelegramLinkingController,
    TelegramNotificationsController,
    TelegramWebhookController,
    TelegramTemplatesController,
    TelegramInventoryAlertsController,
    TelegramStaffController,
    TelegramCustomerApiController,
  ],
  providers: [
    TelegramApiService,
    TelegramSettingsService,
    TelegramLinkingService,
    TelegramNotificationsService,
    TelegramOwnerAlertsService,
    TelegramCustomerBotService,
    TelegramSchedulerService,
    TelegramTemplatesService,
    TelegramInventoryAlertsService,
    TelegramStaffService,
    TelegramCustomerApiService,
  ],
  exports: [
    TelegramApiService,
    TelegramNotificationsService,
    TelegramLinkingService,
    TelegramTemplatesService,
    TelegramInventoryAlertsService,
    TelegramStaffService,
    TelegramCustomerApiService,
  ],
})
export class TelegramModule {}
