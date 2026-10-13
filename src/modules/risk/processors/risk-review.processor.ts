import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { type Job, Queue, UnrecoverableError } from 'bullmq';
import {
  RECONCILE_BATCH_SIZE,
  RECONCILE_EVERY_MS,
  RISK_REVIEW_QUEUE,
  RISK_WORKER_CONCURRENCY,
  STUCK_SUBMISSION_AFTER_MS,
} from '../constants';
import { RiskReviewJob } from '../enums';
import { RiskProviderError } from '../errors';
import { type AssessJobData, type AssessOutcome, type ReconcileOutcome } from '../interfaces';
import { RiskReviewProducer } from '../producers';
import { RiskReviewService } from '../risk-review.service';

@Processor(RISK_REVIEW_QUEUE, { concurrency: RISK_WORKER_CONCURRENCY })
export class RiskReviewProcessor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(RiskReviewProcessor.name);

  constructor(
    private readonly riskReviewService: RiskReviewService,
    private readonly riskReviewProducer: RiskReviewProducer,
    @InjectQueue(RISK_REVIEW_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  public async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      RiskReviewJob.Reconcile,
      { every: RECONCILE_EVERY_MS },
      { name: RiskReviewJob.Reconcile, opts: { attempts: 1 } },
    );
  }

  @OnWorkerEvent('error')
  public onWorkerError(error: Error): void {
    this.logger.error(`Risk review worker error: ${error.message}`, error.stack);
  }

  @OnWorkerEvent('stalled')
  public onJobStalled(jobId: string): void {
    this.logger.warn(`Job ${jobId} stalled and will be retried by another worker`);
  }

  public async process(job: Job): Promise<AssessOutcome | ReconcileOutcome> {
    switch (job.name) {
      case RiskReviewJob.Assess.valueOf():
        return this.handleAssess(job as Job<AssessJobData>);
      case RiskReviewJob.Reconcile.valueOf():
        return this.reconcile();
      default:
        throw new UnrecoverableError(`Unknown job type ${job.name}`);
    }
  }

  private async handleAssess(job: Job<AssessJobData>): Promise<AssessOutcome> {
    const attempt = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? 1;

    try {
      const result = await this.riskReviewService.assess(job.data, attempt);
      this.logger.log(`Job ${job.id ?? 'unknown'} attempt ${attempt}: ${JSON.stringify(result)}`);
      return result;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const retryable = !(error instanceof RiskProviderError) || error.retryable;
      const finalAttempt = !retryable || attempt >= maxAttempts;

      this.logger.warn(
        `Job ${job.id ?? 'unknown'} attempt ${attempt}/${maxAttempts} failed: ${message}` +
          (finalAttempt ? ' (giving up)' : ' (will retry)'),
      );

      if (finalAttempt) {
        await this.riskReviewService.markFailed(job.data, message);
        if (!retryable) {
          throw new UnrecoverableError(message);
        }
      }
      throw error;
    }
  }

  private async reconcile(): Promise<ReconcileOutcome> {
    const stuck = await this.riskReviewService.findStuckSubmissions(
      new Date(Date.now() - STUCK_SUBMISSION_AFTER_MS),
      RECONCILE_BATCH_SIZE,
    );
    for (const data of stuck) {
      await this.riskReviewProducer.requeueAssessment(data);
    }
    if (stuck.length > 0) {
      this.logger.warn(`Re-enqueued ${stuck.length} stuck submission(s)`);
    }
    return { requeued: stuck.length };
  }
}
