import { InvalidStateTransitionError } from '../../../common/errors';
import { ApplicationAction, ApplicationStatus, ReviewDecision } from '../enums';
import {
  actionForDecision,
  canTransition,
  isEditable,
  isTerminal,
  transition,
} from './application-state-machine';

const S = ApplicationStatus;
const A = ApplicationAction;

describe('application state machine', () => {
  const allowed: [ApplicationStatus, ApplicationAction, ApplicationStatus][] = [
    [S.Draft, A.Submit, S.Submitted],
    [S.InfoRequested, A.Submit, S.Submitted],
    [S.RiskFailed, A.Submit, S.Submitted],
    [S.Submitted, A.CompleteRiskReview, S.UnderReview],
    [S.Submitted, A.FailRiskReview, S.RiskFailed],
    [S.UnderReview, A.Approve, S.Approved],
    [S.UnderReview, A.Reject, S.Rejected],
    [S.UnderReview, A.RequestInfo, S.InfoRequested],
  ];

  it.each(allowed)('%s --%s--> %s', (from, action, to) => {
    expect(transition(from, action)).toBe(to);
  });

  const allowedKeys = new Set(allowed.map(([from, action]) => `${from}:${action}`));
  const forbidden = Object.values(S).flatMap((from) =>
    Object.values(A)
      .filter((action) => !allowedKeys.has(`${from}:${action}`))
      .map((action) => [from, action] as const),
  );

  it.each(forbidden)('rejects %s --%s-->', (from, action) => {
    expect(canTransition(from, action)).toBe(false);
    expect(() => transition(from, action)).toThrow(InvalidStateTransitionError);
  });

  it('covers every status/action pair exactly once', () => {
    expect(allowed.length + forbidden.length).toBe(
      Object.values(S).length * Object.values(A).length,
    );
  });

  it('only allows editing in DRAFT and INFO_REQUESTED', () => {
    const editable = Object.values(S).filter(isEditable);
    expect(editable.sort()).toEqual([S.Draft, S.InfoRequested].sort());
  });

  it('treats APPROVED and REJECTED as terminal', () => {
    const terminal = Object.values(S).filter(isTerminal);
    expect(terminal.sort()).toEqual([S.Approved, S.Rejected].sort());
  });

  it('maps reviewer decisions to actions', () => {
    expect(actionForDecision(ReviewDecision.Approve)).toBe(A.Approve);
    expect(actionForDecision(ReviewDecision.Reject)).toBe(A.Reject);
    expect(actionForDecision(ReviewDecision.RequestInfo)).toBe(A.RequestInfo);
  });
});
