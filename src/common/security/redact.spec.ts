import { maskEmail, maskValue, REDACTED, redact } from './redact';

describe('redact', () => {
  it('removes secrets regardless of key casing or separators', () => {
    const result = redact({
      password: 'hunter2',
      accessToken: 'eyJ...',
      access_token: 'eyJ...',
      Authorization: 'Bearer eyJ...',
      apiKey: 'k',
    });
    expect(Object.values(result).every((v) => v === REDACTED)).toBe(true);
  });

  it('masks identifiers and keeps the last four characters', () => {
    expect(redact({ taxId: '12-3456789', bankAccountNumber: '000123456789' })).toEqual({
      taxId: '******6789',
      bankAccountNumber: '********6789',
    });
  });

  it('walks nested objects and arrays without mutating the input', () => {
    const input = {
      owner: { email: 'jane@example.test', phone: '+15555550100' },
      list: [{ password: 'x' }],
    };
    const result = redact(input);
    expect(result).toEqual({
      owner: { email: 'j***@example.test', phone: '********0100' },
      list: [{ password: REDACTED }],
    });
    expect(input.list[0]?.password).toBe('x');
  });

  it('leaves non-sensitive values and primitives alone', () => {
    expect(redact({ businessName: 'Corner Coffee', score: 12 })).toEqual({
      businessName: 'Corner Coffee',
      score: 12,
    });
    expect(redact('plain')).toBe('plain');
    expect(redact(null)).toBeNull();
  });
});

describe('masking helpers', () => {
  it('fully masks values no longer than the visible window', () => {
    expect(maskValue('123')).toBe('***');
  });

  it('masks the local part of an email', () => {
    expect(maskEmail('someone@example.test')).toBe('s***@example.test');
  });
});
