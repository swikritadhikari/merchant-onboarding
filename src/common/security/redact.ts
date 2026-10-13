const SECRET_KEYS: ReadonlySet<string> = new Set([
  'password',
  'passwordhash',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'secret',
  'apikey',
]);

const MASKED_KEYS: ReadonlySet<string> = new Set([
  'taxid',
  'bankaccountnumber',
  'routingnumber',
  'phone',
  'ownerphone',
]);

const MAX_DEPTH = 8;
const DEFAULT_VISIBLE_CHARACTERS = 4;

export const REDACTED = '[REDACTED]';

const normalise = (key: string): string => key.replace(/[^a-z0-9]/gi, '').toLowerCase();

export function maskValue(value: string, visible = DEFAULT_VISIBLE_CHARACTERS): string {
  if (value.length <= visible) {
    return '*'.repeat(value.length);
  }
  return `${'*'.repeat(value.length - visible)}${value.slice(-visible)}`;
}

export function maskEmail(email: string): string {
  const [local = '', domain] = email.split('@');
  if (domain === undefined) {
    return maskValue(email);
  }
  return `${local.charAt(0)}***@${domain}`;
}

function redactValue(input: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH || input === null || typeof input !== 'object' || input instanceof Date) {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item: unknown) => redactValue(item, depth + 1));
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalisedKey = normalise(key);
    if (SECRET_KEYS.has(normalisedKey)) {
      output[key] = REDACTED;
    } else if (MASKED_KEYS.has(normalisedKey) && typeof value === 'string') {
      output[key] = maskValue(value);
    } else if (normalisedKey === 'email' && typeof value === 'string') {
      output[key] = maskEmail(value);
    } else {
      output[key] = redactValue(value, depth + 1);
    }
  }
  return output;
}

export function redact<T>(input: T): T {
  return redactValue(input, 0) as T;
}
