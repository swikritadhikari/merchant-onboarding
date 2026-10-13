import { type UpdateApplicationDto } from '../dto';
import { type MerchantApplication } from '../entities';
import { toOwnerContact } from './owner-contact.mapper';
import { toProcessingProfile } from './processing-profile.mapper';

export function applyApplicationUpdate(
  application: MerchantApplication,
  dto: UpdateApplicationDto,
): string[] {
  const changed: string[] = [];
  if (dto.businessName !== undefined) {
    application.businessName = dto.businessName;
    changed.push('businessName');
  }
  if (dto.legalBusinessName !== undefined) {
    application.legalBusinessName = dto.legalBusinessName;
    changed.push('legalBusinessName');
  }
  if (dto.businessType !== undefined) {
    application.businessType = dto.businessType;
    changed.push('businessType');
  }
  if (dto.taxId !== undefined) {
    application.taxId = dto.taxId;
    changed.push('taxId');
  }
  if (dto.bankAccountNumber !== undefined) {
    application.bankAccountNumber = dto.bankAccountNumber;
    changed.push('bankAccountNumber');
  }
  if (dto.owner !== undefined) {
    application.owner = toOwnerContact(dto.owner);
    changed.push('owner');
  }
  if (dto.processing !== undefined) {
    application.processing = toProcessingProfile(dto.processing);
    changed.push('processing');
  }
  return changed;
}
