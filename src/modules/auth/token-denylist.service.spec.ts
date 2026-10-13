import { Logger } from '@nestjs/common';
import { type CacheService } from '../../common/cache';
import { type AppConfigService } from '../../config/app-config.service';
import { type RefreshTokenService } from './refresh-token.service';
import { TokenDenylistService } from './token-denylist.service';

describe('TokenDenylistService', () => {
  let cache: jest.Mocked<Pick<CacheService, 'setWithTtl' | 'exists'>>;
  let refreshTokenService: jest.Mocked<Pick<RefreshTokenService, 'isSessionRevoked'>>;
  let service: TokenDenylistService;

  beforeAll(() => {
    Logger.overrideLogger(false);
  });

  beforeEach(() => {
    cache = { setWithTtl: jest.fn().mockResolvedValue(true), exists: jest.fn() };
    refreshTokenService = { isSessionRevoked: jest.fn() };
    service = new TokenDenylistService(
      cache as unknown as CacheService,
      refreshTokenService as unknown as RefreshTokenService,
      { jwt: { expiresInSeconds: 900 } } as AppConfigService,
    );
  });

  it('keeps each entry only as long as an access token can live, plus clock skew', async () => {
    await service.denySessions(['s1', 's2']);

    expect(cache.setWithTtl).toHaveBeenCalledWith('denylist:session:s1', '1', 960);
    expect(cache.setWithTtl).toHaveBeenCalledWith('denylist:session:s2', '1', 960);
  });

  it('answers from Redis when Redis is reachable', async () => {
    cache.exists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(service.isSessionDenied('s1')).resolves.toBe(true);
    await expect(service.isSessionDenied('s2')).resolves.toBe(false);
    expect(refreshTokenService.isSessionRevoked).not.toHaveBeenCalled();
  });

  it('falls back to the database when Redis cannot be read', async () => {
    cache.exists.mockResolvedValue(undefined);
    refreshTokenService.isSessionRevoked.mockResolvedValue(true);

    await expect(service.isSessionDenied('s1')).resolves.toBe(true);
    expect(refreshTokenService.isSessionRevoked).toHaveBeenCalledWith('s1');
  });

  it('does not throw when the denylist entry cannot be written', async () => {
    cache.setWithTtl.mockResolvedValue(false);

    await expect(service.denySessions(['s1'])).resolves.toBeUndefined();
  });
});
