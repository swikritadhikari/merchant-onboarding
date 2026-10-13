import { type OwnerContactDto } from '../dto';
import { OwnerContact } from '../entities';

export function toOwnerContact(dto: OwnerContactDto): OwnerContact {
  const owner = new OwnerContact();
  owner.fullName = dto.fullName;
  owner.email = dto.email;
  owner.phone = dto.phone;
  return owner;
}

export function toOwnerContactDto(owner: OwnerContact): OwnerContactDto {
  return { fullName: owner.fullName, email: owner.email, phone: owner.phone };
}
