import { type AssessJobData } from '../interfaces';

export function assessJobId(data: AssessJobData): string {
  return `assess-${data.applicationId}-${data.submissionNo}`;
}
