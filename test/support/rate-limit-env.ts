export const LOGIN_LIMIT = 3;
export const GLOBAL_LIMIT = 5;

process.env.LOGIN_RATE_LIMIT_PER_MINUTE = String(LOGIN_LIMIT);
process.env.RATE_LIMIT_PER_MINUTE = String(GLOBAL_LIMIT);
