import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RISK_REVIEW_QUEUE } from '../constants';
import { RiskReviewJob } from '../enums';
import { type AssessJobData } from '../interfaces';
import { assessJobId } from '../utils';

@Injectable()
export class RiskReviewProducer implements OnModuleInit {
  private readonly logger = new Logger(RiskReviewProducer.name);

  constructor(@InjectQueue(RISK_REVIEW_QUEUE) private readonly queue: Queue) {}

  public onModuleInit(): void {
    this.queue.on('error', (error: Error) => {
      this.logger.error(`Risk review queue error: ${error.message}`);
    });
  }

  public async enqueueAssessment(data: AssessJobData): Promise<void> {
    await this.queue.add(RiskReviewJob.Assess, data, { jobId: assessJobId(data) });
  }

  public async requeueAssessment(data: AssessJobData): Promise<void> {
    const existing = await this.queue.getJob(assessJobId(data));
    if (existing && (await existing.isFailed())) {
      await existing.remove();
    }
    await this.enqueueAssessment(data);
  }
}
