import { BullModule, type RegisterQueueOptions } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { COMPLETED_JOB_RETENTION, FAILED_JOB_RETENTION, RISK_REVIEW_QUEUE } from './constants';
import { RiskReviewProducer } from './producers';

@Module({
  imports: [
    BullModule.registerQueueAsync({
      name: RISK_REVIEW_QUEUE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): RegisterQueueOptions => ({
        defaultJobOptions: {
          attempts: config.riskReview.attempts,
          backoff: { type: 'exponential', delay: config.riskReview.backoffMs },
          removeOnComplete: COMPLETED_JOB_RETENTION,
          removeOnFail: FAILED_JOB_RETENTION,
        },
      }),
    }),
  ],
  providers: [RiskReviewProducer],
  exports: [RiskReviewProducer, BullModule],
})
export class RiskModule {}
