import { BusinessRuleViolationError } from '../../../common/errors';
import { type ProcessingFigures } from '../interfaces';

export function assertProcessingIsConsistent(processing: ProcessingFigures): void {
  if (
    processing.monthlyVolumeMinor > 0 &&
    processing.averageTicketMinor > processing.monthlyVolumeMinor
  ) {
    throw new BusinessRuleViolationError('averageTicketMinor cannot exceed monthlyVolumeMinor');
  }
}
