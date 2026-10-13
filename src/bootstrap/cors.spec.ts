import { isOriginAllowed } from './cors';

describe('isOriginAllowed', () => {
  const allowList = ['https://app.example.test'];

  it('allows listed origins only', () => {
    expect(isOriginAllowed('https://app.example.test', allowList, false)).toBe(true);
    expect(isOriginAllowed('https://evil.example.test', allowList, false)).toBe(false);
  });

  it('allows any localhost port only when local development is enabled', () => {
    expect(isOriginAllowed('http://localhost:5173', [], true)).toBe(true);
    expect(isOriginAllowed('http://127.0.0.1:3001', [], true)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', [], false)).toBe(false);
  });

  it('is not fooled by look-alike hosts', () => {
    expect(isOriginAllowed('http://localhost.evil.test', [], true)).toBe(false);
    expect(isOriginAllowed('https://app.example.test.evil.test', allowList, false)).toBe(false);
  });
});
