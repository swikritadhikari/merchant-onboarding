import { type ApplicationStatus } from '../enums';

export interface ApplicationListFilter {
  createdById?: string;
  assignedReviewerId?: string;
  statuses?: readonly ApplicationStatus[];
  offset: number;
  limit: number;
}
