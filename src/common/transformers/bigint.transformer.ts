import { type ValueTransformer } from 'typeorm';

export const bigintToNumber: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => {
    if (value === null) {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      throw new RangeError(`BIGINT value ${value} exceeds the safe integer range`);
    }
    return parsed;
  },
};
