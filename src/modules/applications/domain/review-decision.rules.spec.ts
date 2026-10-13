import { BusinessRuleViolationError } from '../../../common/errors';
import { ReviewDecision, RiskStatus } from '../enums';
import { assertDecisionIsJustified } from './review-decision.rules';

describe('assertDecisionIsJustified', () => {
  it.each([ReviewDecision.Reject, ReviewDecision.RequestInfo])(
    'requires a note to %s',
    (decision) => {
      expect(() => {
        assertDecisionIsJustified(decision, RiskStatus.Low, undefined);
      }).toThrow(BusinessRuleViolationError);
      expect(() => {
        assertDecisionIsJustified(decision, RiskStatus.Low, '   ');
      }).toThrow(BusinessRuleViolationError);
      expect(() => {
        assertDecisionIsJustified(decision, RiskStatus.Low, 'Missing ID');
      }).not.toThrow();
    },
  );

  it.each([RiskStatus.Low, RiskStatus.Medium])(
    'lets %s risk be approved without a note',
    (risk) => {
      expect(() => {
        assertDecisionIsJustified(ReviewDecision.Approve, risk, undefined);
      }).not.toThrow();
    },
  );

  it('requires justification to approve HIGH risk', () => {
    expect(() => {
      assertDecisionIsJustified(ReviewDecision.Approve, RiskStatus.High, undefined);
    }).toThrow(BusinessRuleViolationError);
    expect(() => {
      assertDecisionIsJustified(ReviewDecision.Approve, RiskStatus.High, 'Reserve agreed');
    }).not.toThrow();
  });
});
