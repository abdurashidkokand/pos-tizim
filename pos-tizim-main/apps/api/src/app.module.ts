import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { PrismaModule } from './db/prisma.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SalesModule } from './modules/sales/sales.module';
import { CashModule } from './modules/cash/cash.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AuditModule } from './modules/audit/audit.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlatformModule } from './modules/platform/platform.module';
import { CustomersModule } from './modules/customers/customers.module';
import { CashbackModule } from './modules/cashback/cashback.module';
import { SignupModule } from './modules/signup/signup.module';
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },   // 20 req/sec
      { name: 'medium', ttl: 60000, limit: 300 }, // 300 req/min
    ]),
    EventEmitterModule.forRoot({ wildcard: false }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    CashModule,
    ReportsModule,
    AuditModule,
    UploadsModule,
    TenantsModule,
    BillingModule,
    PlatformModule,
    CustomersModule,
    CashbackModule,
    SignupModule,
    TelegramModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
