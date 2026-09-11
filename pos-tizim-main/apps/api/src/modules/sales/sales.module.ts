import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule], // EventEmitter is global (registered in AppModule)
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
