const HOP_COUNT = /^\d+$/;

export function parseTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return HOP_COUNT.test(value) ? Number(value) : value;
}
