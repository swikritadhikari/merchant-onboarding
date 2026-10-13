import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { setTimeout as sleep } from 'timers/promises';
import { BusinessType } from '../../applications/enums';
import { AppConfigService } from '../../../config/app-config.service';
import {
  BASE_SCORE_RANGE,
  HIGH_RISK_MCC_PENALTY,
  HIGH_RISK_MCCS,
  HIGH_RISK_THRESHOLD,
  HIGH_VOLUME_PENALTY,
  HIGH_VOLUME_THRESHOLD_MINOR,
  MAX_SCORE,
  MEDIUM_RISK_THRESHOLD,
  SIMULATED_PROVIDER_NAME,
  SOLE_PROPRIETORSHIP_PENALTY,
} from '../constants';
import { RiskLevel } from '../enums';
import { RiskProviderError } from '../errors';
import {
  type RiskAssessmentRequest,
  type RiskAssessmentResult,
  type RiskProvider,
} from '../interfaces';

const HASH_PREFIX_LENGTH = 8;
const REFERENCE_LENGTH = 16;
const HEX_RADIX = 16;

@Injectable()
export class SimulatedRiskProvider implements RiskProvider {
  private readonly logger = new Logger(SimulatedRiskProvider.name);

  constructor(private readonly config: AppConfigService) {}

  public static score(request: RiskAssessmentRequest): RiskAssessmentResult {
    const digest = createHash('sha256')
      .update(`${request.legalBusinessName.toLowerCase()}|${request.taxId}`)
      .digest('hex');

    const reasons: string[] = [];
    let score = parseInt(digest.slice(0, HASH_PREFIX_LENGTH), HEX_RADIX) % BASE_SCORE_RANGE;

    if (HIGH_RISK_MCCS.has(request.mcc)) {
      score += HIGH_RISK_MCC_PENALTY;
      reasons.push('HIGH_RISK_MCC');
    }
    if (request.monthlyVolumeMinor >= HIGH_VOLUME_THRESHOLD_MINOR) {
      score += HIGH_VOLUME_PENALTY;
      reasons.push('HIGH_PROCESSING_VOLUME');
    }
    if (request.businessType === BusinessType.SoleProprietorship) {
      score += SOLE_PROPRIETORSHIP_PENALTY;
      reasons.push('LIMITED_CORPORATE_STRUCTURE');
    }
    score = Math.min(score, MAX_SCORE);

    return {
      provider: SIMULATED_PROVIDER_NAME,
      providerReference: `kyb_${digest.slice(0, REFERENCE_LENGTH)}`,
      score,
      level: SimulatedRiskProvider.levelFor(score),
      reasons,
    };
  }

  public static levelFor(score: number): RiskLevel {
    if (score >= HIGH_RISK_THRESHOLD) return RiskLevel.High;
    if (score >= MEDIUM_RISK_THRESHOLD) return RiskLevel.Medium;
    return RiskLevel.Low;
  }

  public async assess(
    request: RiskAssessmentRequest,
    signal: AbortSignal,
  ): Promise<RiskAssessmentResult> {
    const { providerLatencyMs, providerFailureRate } = this.config.riskReview;
    await sleep(providerLatencyMs, undefined, { signal });

    if (Math.random() < providerFailureRate) {
      this.logger.warn(`Simulated provider outage for ${request.idempotencyKey}`);
      throw new RiskProviderError('Risk provider temporarily unavailable', true);
    }

    return SimulatedRiskProvider.score(request);
  }
}
