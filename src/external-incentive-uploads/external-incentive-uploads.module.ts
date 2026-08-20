// src/external-incentive-uploads/external-incentive-uploads.module.ts
import { Module } from '@nestjs/common';
import { ExternalIncentiveUploadsController } from './external-incentive-uploads.controller';
import { ExternalIncentiveUploadsService } from './external-incentive-uploads.service';

@Module({
  controllers: [ExternalIncentiveUploadsController],
  providers: [ExternalIncentiveUploadsService],
  exports: [ExternalIncentiveUploadsService],
})
export class ExternalIncentiveUploadsModule {}
