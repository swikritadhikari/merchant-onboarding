import { type ProcessingProfileDto } from '../dto';
import { ProcessingProfile } from '../entities';

export function toProcessingProfile(dto: ProcessingProfileDto): ProcessingProfile {
  const processing = new ProcessingProfile();
  processing.monthlyVolumeMinor = dto.monthlyVolumeMinor;
  processing.averageTicketMinor = dto.averageTicketMinor;
  processing.currency = dto.currency;
  processing.mcc = dto.mcc;
  return processing;
}

export function toProcessingProfileDto(processing: ProcessingProfile): ProcessingProfileDto {
  return {
    monthlyVolumeMinor: processing.monthlyVolumeMinor,
    averageTicketMinor: processing.averageTicketMinor,
    currency: processing.currency,
    mcc: processing.mcc,
  };
}
