import {
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';
import { ErrorCode } from '../../enums';
import {
  AccessDeniedError,
  BusinessRuleViolationError,
  InvalidStateTransitionError,
  ResourceNotFoundError,
  ValidationFailedError,
} from '../../errors';
import { resolveError } from './resolve-error';

const pgError = (code: string, constraint?: string): QueryFailedError =>
  new QueryFailedError('SELECT 1', [], Object.assign(new Error('pg'), { code, constraint }));

describe('resolveError', () => {
  describe('domain errors', () => {
    it.each([
      [new ResourceNotFoundError('Application'), HttpStatus.NOT_FOUND, ErrorCode.NotFound],
      [new AccessDeniedError('no'), HttpStatus.FORBIDDEN, ErrorCode.Forbidden],
      [
        new InvalidStateTransitionError('DRAFT', 'APPROVE'),
        HttpStatus.CONFLICT,
        ErrorCode.InvalidStateTransition,
      ],
      [
        new BusinessRuleViolationError('rule'),
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCode.BusinessRuleViolation,
      ],
    ])('maps %s', (error, status, code) => {
      expect(resolveError(error)).toMatchObject({ status, code, message: error.message });
    });

    it('carries validation details', () => {
      const details = [{ field: 'owner.email', messages: ['owner.email must be an email'] }];
      expect(resolveError(new ValidationFailedError(details))).toEqual({
        status: HttpStatus.BAD_REQUEST,
        code: ErrorCode.ValidationFailed,
        message: 'Request validation failed',
        details,
      });
    });
  });

  describe('HTTP exceptions', () => {
    it('keeps meaningful client messages', () => {
      expect(resolveError(new UnauthorizedException('Invalid refresh token'))).toMatchObject({
        status: 401,
        code: ErrorCode.Unauthorized,
        message: 'Invalid refresh token',
      });
      expect(resolveError(new NotFoundException('Cannot GET /nope'))).toMatchObject({
        code: ErrorCode.NotFound,
        message: 'Cannot GET /nope',
      });
    });

    it('replaces the bare passport message with a clear one', () => {
      expect(resolveError(new UnauthorizedException()).message).toBe('Authentication is required');
    });

    it('maps throttling to RATE_LIMITED with a generic message', () => {
      expect(resolveError(new ThrottlerException())).toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ErrorCode.RateLimited,
        message: 'Too many requests, please retry later',
      });
    });

    it('never echoes server-side exception messages', () => {
      expect(
        resolveError(new InternalServerErrorException('db password is hunter2')),
      ).toMatchObject({
        status: 500,
        code: ErrorCode.InternalError,
        message: 'An unexpected error occurred',
      });
    });

    it('joins array messages', () => {
      expect(resolveError(new BadRequestException(['a', 'b'])).message).toBe('a; b');
    });
  });

  describe('database errors', () => {
    it('maps a known unique constraint to a friendly conflict', () => {
      expect(resolveError(pgError('23505', 'uq_users_email'))).toMatchObject({
        status: HttpStatus.CONFLICT,
        code: ErrorCode.Conflict,
        message: 'A user with this email already exists',
      });
    });

    it('maps an unknown unique constraint to a generic conflict', () => {
      expect(resolveError(pgError('23505', 'uq_other')).message).toBe('Resource already exists');
    });

    it.each([
      ['23503', HttpStatus.CONFLICT, ErrorCode.Conflict],
      ['23514', HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.BusinessRuleViolation],
      ['22P02', HttpStatus.BAD_REQUEST, ErrorCode.BadRequest],
      ['22001', HttpStatus.BAD_REQUEST, ErrorCode.BadRequest],
    ])('maps SQLSTATE %s', (code, status, errorCode) => {
      expect(resolveError(pgError(code))).toMatchObject({ status, code: errorCode });
    });

    it.each(['40001', '40P01', '55P03', '57014', '57P01', '53300', '08006'])(
      'treats SQLSTATE %s as transient and asks the client to retry',
      (code) => {
        expect(resolveError(pgError(code))).toMatchObject({
          status: HttpStatus.SERVICE_UNAVAILABLE,
          code: ErrorCode.ServiceUnavailable,
          retryAfterSeconds: 1,
        });
      },
    );

    it('maps EntityNotFoundError to 404', () => {
      expect(resolveError(new EntityNotFoundError('User', {})).status).toBe(HttpStatus.NOT_FOUND);
    });

    it('falls back to 500 for unclassified SQLSTATEs', () => {
      expect(resolveError(pgError('23502')).code).toBe(ErrorCode.InternalError);
    });
  });

  describe('infrastructure and parser errors', () => {
    it('maps network failures to 503', () => {
      const refused = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
      expect(resolveError(refused).status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(resolveError(new Error('Connection terminated unexpectedly')).status).toBe(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });

    it.each([
      ['entity.parse.failed', HttpStatus.BAD_REQUEST, ErrorCode.BadRequest],
      ['entity.too.large', HttpStatus.PAYLOAD_TOO_LARGE, ErrorCode.PayloadTooLarge],
      ['encoding.unsupported', HttpStatus.UNSUPPORTED_MEDIA_TYPE, ErrorCode.UnsupportedMediaType],
    ])('maps body-parser %s without leaking parser internals', (type, status, code) => {
      const error = Object.assign(new SyntaxError('Unexpected token } at position 7'), { type });
      const resolved = resolveError(error);
      expect(resolved).toMatchObject({ status, code });
      expect(resolved.message).not.toContain('position');
    });

    it('returns a generic 500 for anything else', () => {
      expect(resolveError(new TypeError('cannot read x of undefined'))).toEqual({
        status: 500,
        code: ErrorCode.InternalError,
        message: 'An unexpected error occurred',
      });
      expect(resolveError('a thrown string').code).toBe(ErrorCode.InternalError);
    });
  });
});
