import { Logger } from '@nestjs/common';
import { type Job, type Queue, UnrecoverableError } from 'bullmq';
import { RiskLevel, RiskReviewJob } from '../enums';
import { RiskProviderError } from '../errors';
import { type AssessJobData } from '../interfaces';
import { type RiskReviewProducer } from '../producers';
import { type RiskReviewService } from '../risk-review.service';
import { RiskReviewProcessor } from './risk-review.processor';

const data: AssessJobData = { applicationId: 'app-1', submissionNo: 1 };

const job = (attemptsMade: number, attempts = 3) =>
  ({
    id: 'job-1',
    name: RiskReviewJob.Assess,
    data,
    attemptsMade,
    opts: { attempts },
  }) as Job<AssessJobData>;

describe('RiskReviewProcessor', () => {
  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  let service: jest.Mocked<
    Pick<RiskReviewService, 'assess' | 'markFailed' | 'findStuckSubmissions'>
  >;
  let queue: jest.Mocked<Pick<RiskReviewProducer, 'requeueAssessment'>>;
  let processor: RiskReviewProcessor;

  beforeEach(() => {
    service = { assess: jest.fn(), markFailed: jest.fn(), findStuckSubmissions: jest.fn() };
    queue = { requeueAssessment: jest.fn() };
    processor = new RiskReviewProcessor(
      service as unknown as RiskReviewService,
      queue as unknown as RiskReviewProducer,
      {} as Queue,
    );
  });

  it('passes the 1-based attempt number to the service', async () => {
    service.assess.mockResolvedValue({ outcome: 'completed', riskLevel: RiskLevel.Low, score: 10 });
    await processor.process(job(1));
    expect(service.assess).toHaveBeenCalledWith(data, 2);
  });

  it('rethrows transient errors without failing the application while retries remain', async () => {
    service.assess.mockRejectedValue(new RiskProviderError('timeout', true));
    await expect(processor.process(job(0))).rejects.toThrow('timeout');
    expect(service.markFailed).not.toHaveBeenCalled();
  });

  it('marks the application failed on the final attempt', async () => {
    service.assess.mockRejectedValue(new RiskProviderError('timeout', true));
    await expect(processor.process(job(2, 3))).rejects.toThrow('timeout');
    expect(service.markFailed).toHaveBeenCalledWith(data, 'timeout');
  });

  it('treats unexpected errors (e.g. database) as retryable', async () => {
    service.assess.mockRejectedValue(new Error('connection reset'));
    await expect(processor.process(job(0))).rejects.toThrow('connection reset');
    expect(service.markFailed).not.toHaveBeenCalled();
  });

  it('stops retrying immediately on a permanent provider error', async () => {
    service.assess.mockRejectedValue(new RiskProviderError('invalid tax id', false));
    await expect(processor.process(job(0))).rejects.toBeInstanceOf(UnrecoverableError);
    expect(service.markFailed).toHaveBeenCalledWith(data, 'invalid tax id');
  });

  it('re-enqueues stuck submissions when reconciling', async () => {
    service.findStuckSubmissions.mockResolvedValue([data]);
    await expect(processor.process({ name: RiskReviewJob.Reconcile } as Job)).resolves.toEqual({
      requeued: 1,
    });
    expect(queue.requeueAssessment).toHaveBeenCalledWith(data);
  });

  it('rejects unknown job types without retrying', async () => {
    await expect(processor.process({ name: 'nope' } as Job)).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
