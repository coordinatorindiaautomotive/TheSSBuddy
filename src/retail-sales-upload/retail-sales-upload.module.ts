import { Module } from '@nestjs/common';
import { RetailSalesUploadController } from './retail-sales-upload.controller';
import { RetailSalesUploadService } from './retail-sales-upload.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [RetailSalesUploadController],
  providers: [RetailSalesUploadService],
  exports: [RetailSalesUploadService],
})
export class RetailSalesUploadModule {}
