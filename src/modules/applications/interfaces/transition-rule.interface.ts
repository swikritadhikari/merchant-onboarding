import { type ApplicationStatus } from '../enums';

export interface TransitionRule {
  from: readonly ApplicationStatus[];
  to: ApplicationStatus;
}
