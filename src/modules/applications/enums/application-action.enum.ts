export enum ApplicationAction {
  Submit = 'SUBMIT',
  CompleteRiskReview = 'COMPLETE_RISK_REVIEW',
  FailRiskReview = 'FAIL_RISK_REVIEW',
  Approve = 'APPROVE',
  Reject = 'REJECT',
  RequestInfo = 'REQUEST_INFO',
}

export enum ApplicationOperation {
  Edit = 'EDIT',
  AssignReviewer = 'ASSIGN_REVIEWER',
}
