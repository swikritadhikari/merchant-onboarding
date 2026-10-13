import { RiskProviderError } from '../../src/modules/risk/errors';
import {
  type RiskAssessmentRequest,
  type RiskAssessmentResult,
  type RiskProvider,
} from '../../src/modules/risk/interfaces';
import { SimulatedRiskProvider } from '../../src/modules/risk/providers';

type Step =
  { fail: RiskProviderError } | { result: Partial<RiskAssessmentResult> } | { hang: true };

export class ScriptedRiskProvider implements RiskProvider {
  readonly calls: RiskAssessmentRequest[] = [];
  private script: Step[] = [];

  failTransiently(times: number): this {
    for (let i = 0; i < times; i++) {
      this.script.push({ fail: new RiskProviderError('Simulated timeout', true) });
    }
    return this;
  }

  failPermanently(message = 'Tax id rejected by registry'): this {
    this.script.push({ fail: new RiskProviderError(message, false) });
    return this;
  }

  respondWith(result: Partial<RiskAssessmentResult>): this {
    this.script.push({ result });
    return this;
  }

  hangOnce(): this {
    this.script.push({ hang: true });
    return this;
  }

  reset(): void {
    this.calls.length = 0;
    this.script = [];
  }

  assess(request: RiskAssessmentRequest, signal: AbortSignal): Promise<RiskAssessmentResult> {
    this.calls.push(request);
    const step = this.script.shift();
    if (step && 'hang' in step) {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
        });
      });
    }
    if (step && 'fail' in step) {
      return Promise.reject(step.fail);
    }
    return Promise.resolve({ ...SimulatedRiskProvider.score(request), ...(step?.result ?? {}) });
  }
}
