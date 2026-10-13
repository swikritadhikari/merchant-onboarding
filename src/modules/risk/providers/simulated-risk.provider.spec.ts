import { BusinessType } from '../../applications/enums';
import { type AppConfigService } from '../../../config/app-config.service';
import { RiskLevel } from '../enums';
import { RiskProviderError } from '../errors';
import { type RiskAssessmentRequest } from '../interfaces';
import { SimulatedRiskProvider } from './simulated-risk.provider';

const request = (overrides: Partial<RiskAssessmentRequest> = {}): RiskAssessmentRequest => ({
  idempotencyKey: 'app-1:1',
  legalBusinessName: 'Corner Coffee Holdings LLC',
  businessType: BusinessType.LimitedLiabilityCompany,
  taxId: '00-0000001',
  mcc: '5812',
  monthlyVolumeMinor: 2_500_000,
  ...overrides,
});

const providerWith = (failureRate: number) =>
  new SimulatedRiskProvider({
    riskReview: { providerLatencyMs: 0, providerFailureRate: failureRate },
  } as AppConfigService);

describe('SimulatedRiskProvider', () => {
  it('is deterministic for the same input', () => {
    expect(SimulatedRiskProvider.score(request())).toEqual(SimulatedRiskProvider.score(request()));
  });

  it('raises the score for high-risk MCCs and high volume', () => {
    const base = SimulatedRiskProvider.score(request());
    const risky = SimulatedRiskProvider.score(
      request({ mcc: '7995', monthlyVolumeMinor: 200_000_000 }),
    );
    expect(risky.score).toBe(Math.min(base.score + 50, 100));
    expect(risky.reasons).toEqual(['HIGH_RISK_MCC', 'HIGH_PROCESSING_VOLUME']);
    expect(risky.level).toBe(RiskLevel.High);
  });

  it.each([
    [0, RiskLevel.Low],
    [39, RiskLevel.Low],
    [40, RiskLevel.Medium],
    [69, RiskLevel.Medium],
    [70, RiskLevel.High],
    [100, RiskLevel.High],
  ])('maps score %d to %s', (score, level) => {
    expect(SimulatedRiskProvider.levelFor(score)).toBe(level);
  });

  it('throws a retryable error when the simulated outage triggers', async () => {
    await expect(
      providerWith(1).assess(request(), new AbortController().signal),
    ).rejects.toMatchObject({
      constructor: RiskProviderError,
      retryable: true,
    });
  });

  it('returns a result when the provider is healthy', async () => {
    await expect(
      providerWith(0).assess(request(), new AbortController().signal),
    ).resolves.toMatchObject({
      provider: 'simulated-kyb',
    });
  });
});
