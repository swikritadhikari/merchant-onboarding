export const USERS_LIST_CACHE_PREFIX = 'users:list:';

export const principalCacheKey = (userId: string): string => `principal:${userId}`;

export const usersListCacheKey = (role: string | undefined): string =>
  `${USERS_LIST_CACHE_PREFIX}${role ?? 'all'}`;
