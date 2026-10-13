import { InvalidStateTransitionError } from '../../../common/errors';
import { ApplicationAction, ApplicationStatus, ReviewDecision } from '../enums';
import { type TransitionRule } from '../interfaces';

const TRANSITIONS: Readonly<Record<ApplicationAction, TransitionRule>> = {
  [ApplicationAction.Submit]: {
    from: [ApplicationStatus.Draft, ApplicationStatus.InfoRequested, ApplicationStatus.RiskFailed],
    to: ApplicationStatus.Submitted,
  },
  [ApplicationAction.CompleteRiskReview]: {
    from: [ApplicationStatus.Submitted],
    to: ApplicationStatus.UnderReview,
  },
  [ApplicationAction.FailRiskReview]: {
    from: [ApplicationStatus.Submitted],
    to: ApplicationStatus.RiskFailed,
  },
  [ApplicationAction.Approve]: {
    from: [ApplicationStatus.UnderReview],
    to: ApplicationStatus.Approved,
  },
  [ApplicationAction.Reject]: {
    from: [ApplicationStatus.UnderReview],
    to: ApplicationStatus.Rejected,
  },
  [ApplicationAction.RequestInfo]: {
    from: [ApplicationStatus.UnderReview],
    to: ApplicationStatus.InfoRequested,
  },
};

const EDITABLE_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.Draft,
  ApplicationStatus.InfoRequested,
]);

const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set([
  ApplicationStatus.Approved,
  ApplicationStatus.Rejected,
]);

export function canTransition(from: ApplicationStatus, action: ApplicationAction): boolean {
  return TRANSITIONS[action].from.includes(from);
}

export function transition(from: ApplicationStatus, action: ApplicationAction): ApplicationStatus {
  if (!canTransition(from, action)) {
    throw new InvalidStateTransitionError(from, action);
  }
  return TRANSITIONS[action].to;
}

export function isEditable(status: ApplicationStatus): boolean {
  return EDITABLE_STATUSES.has(status);
}

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function actionForDecision(decision: ReviewDecision): ApplicationAction {
  switch (decision) {
    case ReviewDecision.Approve:
      return ApplicationAction.Approve;
    case ReviewDecision.Reject:
      return ApplicationAction.Reject;
    case ReviewDecision.RequestInfo:
      return ApplicationAction.RequestInfo;
  }
}
