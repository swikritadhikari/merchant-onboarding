import { BusinessRuleViolationError } from '../../../common/errors';
import { ReviewDecision, RiskStatus } from '../enums';

export function assertDecisionIsJustified(
  decision: ReviewDecision,
  riskStatus: RiskStatus,
  note: string | undefined,
): void {
  const hasNote = note !== undefined && note.trim().length > 0;
  if (hasNote) {
    return;
  }
  if (decision === ReviewDecision.Reject || decision === ReviewDecision.RequestInfo) {
    throw new BusinessRuleViolationError(`A note is required to ${decision.toLowerCase()}`);
  }
  if (riskStatus === RiskStatus.High) {
    throw new BusinessRuleViolationError('Approving a HIGH risk application requires a note');
  }
}
