# Merchant Onboarding API

A NestJS service for onboarding merchants for card payments. Sales staff create merchant applications, a background worker runs a (simulated) third-party KYB/risk check, and an assigned reviewer approves, rejects or asks for more information. Every significant action is written to an append-only audit trail.

| | |
|---|---|
| Runtime | Node.js 22, TypeScript 5 (strict) |
| Framework | NestJS 11 |
| Database | PostgreSQL 14+ via TypeORM 0.3, schema managed by migrations only |
| Queue | Redis 7 + BullMQ 5 |
| Auth | Short-lived JWT access tokens + rotating opaque refresh tokens + session denylist, role guard + object-level policy |
| Caching | Redis read-through cache for the per-request principal lookup and the user list, with write-time eviction |
| Docs | OpenAPI / Swagger UI at `/docs` |
| Tests | Jest (unit) + Supertest against real Postgres/Redis (integration) |

More detail: [docs/architecture.md](docs/architecture.md) explains the project structure, the repository pattern, type-safety settings and how the parts fit together. [docs/decisions.md](docs/decisions.md) records the key decisions and their trade-offs.

---

## Contents

1. [Quick start](#quick-start)
2. [Configuration](#configuration)
3. [API overview](#api-overview)
4. [Error handling](#error-handling)
5. [Security, rate limiting and operations](#security-rate-limiting-and-operations)
6. [Application lifecycle](#application-lifecycle)
7. [Authorization model](#authorization-model)
8. [Asynchronous risk review](#asynchronous-risk-review)
9. [Data model](#data-model)
10. [Indexing and query performance](#indexing-and-query-performance)
11. [Caching](#caching)
12. [Audit trail and sensitive data](#audit-trail-and-sensitive-data)
13. [Testing](#testing)
14. [Trade-offs and next steps](#trade-offs-and-next-steps)

---

## Quick start

### Option A: everything in Docker

```bash
cp .env.example .env
# Fill in DB_PASSWORD, JWT_SECRET (openssl rand -base64 48) and SEED_USER_PASSWORD (12+ chars)

docker compose --profile app up -d --build   # postgres, redis, api, worker
```

The `api` container runs migrations on start, then serves on `http://localhost:3000`. The `worker` container consumes the risk-review queue. To create demo users, run the seed from your machine (it needs `npm ci` first):

```bash
npm ci
npm run seed
```

### Option B: run the app locally

```bash
npm ci
cp .env.example .env                 # fill in the blanks
docker compose up -d postgres redis  # or point DB_* / REDIS_* at your own instances
npm run migration:run
npm run seed
npm run start:dev                    # API + in-process worker on :3000
```

Open **http://localhost:3000/docs**, call `POST /api/v1/auth/login` with one of the seeded users and the `SEED_USER_PASSWORD` you chose, then click **Authorize** and paste the token.

Seeded users (all on the reserved `.test` domain):

| Email | Role |
|---|---|
| admin@example.test | ADMIN |
| reviewer.one@example.test, reviewer.two@example.test | REVIEWER |
| sales.one@example.test, sales.two@example.test | SALES |

### Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | API with in-process worker, watch mode |
| `npm run start:worker:dev` | Standalone worker, watch mode |
| `npm run build` / `start:prod` / `start:worker` | Production build and entry points |
| `npm run migration:run` / `migration:revert` | Apply / roll back migrations |
| `npm run migration:generate -- src/database/migrations/Name` | Generate a migration from entity changes |
| `npm run seed` | Create demo users |
| `npm test` / `test:unit` / `test:int` / `test:cov` | Tests |
| `npm run lint` / `typecheck` | Static checks |

### Code organisation

- Each module's root holds only `*.module.ts`, `*.controller.ts`, `*.service.ts` and `*.repository.ts`. Everything else lives in folders (`dto/`, `entities/`, `enums/`, `interfaces/`, `domain/`, `mappers/`, `constants/`, …), each with an `index.ts` barrel.
- **Repository pattern:** all database access lives in repository classes. Services describe business flow and use `TransactionService.run()`, and repositories join the ambient transaction automatically.
- **Strict typing:** `strict` TypeScript plus `noUncheckedIndexedAccess`, `strictPropertyInitialization` and unused-code checks, linted with `typescript-eslint` `strictTypeChecked`.

---

## Configuration

All configuration comes from environment variables and is validated at startup (`src/config/validation/environment-variables.ts`). The process refuses to start if a required value is missing or malformed, for example a `JWT_SECRET` shorter than 32 characters. No secrets are committed: `.env` is git-ignored and `.env.example` contains only empty placeholders.

| Variable | Default | Notes |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | | PostgreSQL connection |
| `DB_TEST_NAME` | | Separate database for integration tests; created automatically on first run |
| `REDIS_HOST`, `REDIS_PORT` | | BullMQ connection |
| `JWT_SECRET` | | ≥ 32 chars |
| `JWT_EXPIRES_IN_SECONDS` | 900 | Short-lived access tokens |
| `REFRESH_TOKEN_EXPIRES_IN_SECONDS` | 604800 | Refresh token lifetime (7 days, renewed on each rotation) |
| `CACHE_KEY_PREFIX` | cache | Namespace for cache keys in Redis |
| `AUTH_PRINCIPAL_CACHE_TTL_SECONDS` | 60 | TTL of the cached user behind each access token (0 disables) |
| `USERS_LIST_CACHE_TTL_SECONDS` | 300 | TTL of the cached user list (0 disables) |
| `NODE_ENV` | development | `development`, `test` or `production`; changes logging, Swagger, CORS defaults, HSTS and config validation |
| `CORS_ORIGINS` | | Comma-separated allow-list. Empty in development allows `http://localhost:*` |
| `TRUST_PROXY` | false | `true`, hop count, or `loopback`; set behind a load balancer so client IPs (rate limiting) are correct |
| `SWAGGER_ENABLED` | on outside production | Serve `/docs` |
| `HTTP_REQUEST_TIMEOUT_MS` | 30000 | Server-side request timeout |
| `SHUTDOWN_TIMEOUT_MS` | 15000 | Deadline for graceful shutdown before a forced exit |
| `RATE_LIMIT_PER_MINUTE` | 120 | Global per-client limit |
| `LOGIN_RATE_LIMIT_PER_MINUTE` | 10 | Per-client limit on `/api/v1/auth/login` and `/api/v1/auth/refresh` |
| `JWT_ISSUER`, `JWT_AUDIENCE` | | Signed into and verified on every access token |
| `DB_STATEMENT_TIMEOUT_MS` / `DB_LOCK_TIMEOUT_MS` / `DB_CONNECT_TIMEOUT_MS` | 15000 / 5000 / 5000 | PostgreSQL timeouts |
| `RISK_PROVIDER_TIMEOUT_MS` | 5000 | Abort a vendor call that takes longer; retried as a transient failure |
| `PASSWORD_HASH_ROUNDS` | 12 | bcrypt cost |
| `RISK_WORKER_ENABLED` | true | Run the queue consumer inside the API process |
| `RISK_JOB_ATTEMPTS` | 5 | Attempts per risk job |
| `RISK_JOB_BACKOFF_MS` | 2000 | Base delay for exponential backoff |
| `RISK_PROVIDER_LATENCY_MS` | 300 | Simulated vendor latency |
| `RISK_PROVIDER_FAILURE_RATE` | 0 | Probability (0..1) of a simulated transient vendor error |
| `SEED_USER_PASSWORD` | | Only used by `npm run seed` |

---

## API overview

All API routes are versioned under **`/api/v1`** (global `api` prefix + Nest URI versioning, default version `1`). Health probes stay at `/health/live` and `/health/ready`, outside the prefix and version-neutral, so load balancers and orchestrators use a path that never changes between API versions. Swagger UI is at `/docs`.

Every route requires a bearer token except `POST /api/v1/auth/login`, `/api/v1/auth/refresh` and `/api/v1/auth/logout`. Full schemas are in Swagger.

| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | public | Rate limited. Same 401 for unknown email and wrong password. Returns access + refresh token |
| POST | `/api/v1/auth/refresh` | public (refresh token) | Rotates the refresh token; reusing an old one revokes the session |
| POST | `/api/v1/auth/logout` | public (refresh token) | Revokes the session and its access tokens immediately; always `204` |
| POST | `/api/v1/auth/logout-all` | any (access token) | Signs the caller out of every session/device |
| GET | `/api/v1/auth/me` | any | |
| GET | `/api/v1/users?role=REVIEWER` | ADMIN | Pick an assignee (cached) |
| PATCH | `/api/v1/users/:id` | ADMIN | Change role or deactivate; effective immediately, audited. Admins cannot demote or deactivate themselves |
| POST | `/api/v1/applications` | SALES, ADMIN | Creates a `DRAFT` |
| GET | `/api/v1/applications` | any | `?status=A,B&page=&limit=&assignedToMe=true`. SALES only see their own |
| GET | `/api/v1/applications/:id` | any | SALES: own only (otherwise 404) |
| PATCH | `/api/v1/applications/:id` | SALES (owner), ADMIN | Only while `DRAFT` or `INFO_REQUESTED` |
| POST | `/api/v1/applications/:id/submit` | SALES (owner), ADMIN | `202`, enqueues risk review |
| POST | `/api/v1/applications/:id/assign` | ADMIN | Assignee must be an active REVIEWER |
| POST | `/api/v1/applications/:id/decision` | assigned REVIEWER | `APPROVE`, `REJECT` or `REQUEST_INFO` |
| GET | `/api/v1/applications/:id/audit-events` | ADMIN, REVIEWER | |

Money is sent and stored as integers in minor units (`monthlyVolumeMinor: 2500000` = 25,000.00) with an ISO 4217 `currency`. This avoids floating-point errors.

---

## Error handling

Every error, from any layer, leaves the API in one shape:

```json
{
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Request validation failed",
  "details": [{ "field": "owner.email", "messages": ["owner.email must be an email"] }],
  "path": "/applications",
  "method": "POST",
  "requestId": "6f1c2b8e-…",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

`code` is a stable, machine-readable value (clients switch on it, not on `message`). `details` appears for validation errors and uses dotted paths for nested fields. `requestId` matches the `X-Request-Id` response header and every log line for that request.

| Code | Status | When |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Body, query or path parameter invalid; unknown fields rejected (blocks mass assignment) |
| `BAD_REQUEST` | 400 | Malformed JSON, or a value the database cannot accept |
| `UNAUTHORIZED` | 401 | Missing, invalid, expired or revoked token |
| `FORBIDDEN` | 403 | Role not allowed, or not the assigned reviewer |
| `NOT_FOUND` | 404 | Unknown route, or a resource that does not exist **or is not visible to the caller** |
| `CONFLICT` | 409 | Unique or foreign-key conflict |
| `INVALID_STATE_TRANSITION` | 409 | Action not allowed in the current status |
| `PAYLOAD_TOO_LARGE` | 413 | Body over 100 kB |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Body sent without `Content-Type: application/json` |
| `BUSINESS_RULE_VIOLATION` | 422 | Domain rule broken (e.g. rejecting without a note) or a database check constraint |
| `RATE_LIMITED` | 429 | Too many requests; see `Retry-After` |
| `INTERNAL_ERROR` | 500 | Anything unexpected; generic message, details only in the logs |
| `SERVICE_UNAVAILABLE` | 503 | Database or Redis unreachable, deadlock, lock or statement timeout; includes `Retry-After: 1` |

**How it works**

- Business rules throw typed domain errors (`ResourceNotFoundError`, `InvalidStateTransitionError`, `ValidationFailedError`, …). Each carries an `ErrorCode`, and one table (`ERROR_HTTP_STATUS`) maps codes to HTTP statuses. The domain layer knows nothing about HTTP.
- `resolveError()` runs a chain of small, pure, unit-tested mappers: domain errors, Nest HTTP exceptions, body-parser errors, PostgreSQL errors (by SQLSTATE: `23505` unique, `23503` FK, `23514` check, `22P02` bad input, `40001`/`40P01`/`55P03`/`57014`/`08xxx` transient), and network errors (`ECONNREFUSED`, …). Anything unrecognised becomes a generic 500.
- The same resolver serves the global Nest exception filter **and** an Express error middleware. Errors raised before Nest's pipeline (malformed JSON, oversized bodies) therefore get the same shape and request ID.
- Validation uses a custom `exceptionFactory` that flattens class-validator's nested errors into `details`. `@UuidParam()` reports bad path IDs the same way.
- Messages that could leak internals are never echoed. 5xx responses use a fixed message, parser errors are rephrased, and constraint names map to friendly text. In `development` only, 5xx responses add a `debug` object (error name and message) to speed up local work.
- Logging is by severity: 500 at `error` with the stack, 503 at `warn`, 4xx at `debug`. Each line carries method, path, status, code, request ID and user ID.

**Outside the request path**

- The risk-vendor call is bounded by `RISK_PROVIDER_TIMEOUT_MS` through an `AbortSignal`, and a timeout is retried like any transient vendor failure.
- PostgreSQL statement, lock-wait and connect timeouts are set on the pool, so a stuck query cannot hold a worker or a connection forever.
- The BullMQ worker and queue have `error` listeners. In Node, an `error` event with no listener crashes the process. Stalled jobs are logged.
- A corrupted cache entry is discarded and reloaded instead of failing the request.
- `unhandledRejection` and `uncaughtException` trigger a logged, graceful shutdown with exit code 1. A failure during startup logs the cause and exits with 1.

---

## Security, rate limiting and operations

**HTTP hardening**

- `helmet` security headers, with HSTS only in production, `Referrer-Policy: no-referrer`, and no `X-Powered-By`.
- `Cache-Control: no-store` on every response.
- CORS uses an explicit allow-list (`CORS_ORIGINS`) with an exact-match check. Development falls back to `http://localhost:*` only when the list is empty. No credentials mode is used (bearer tokens, not cookies). `X-Request-Id` and `Retry-After` are exposed to browsers.
- JSON bodies only (415 otherwise), at most 100 kB (413). There is a server request timeout, and `trust proxy` is configurable so client IPs are correct behind a load balancer.
- Access tokens are HS256 only, with issuer and audience signed in and verified. See the authorization model below.

**Rate limiting**

- A global limit (`RATE_LIMIT_PER_MINUTE`) applies per client IP on every route, and a stricter limit (`LOGIN_RATE_LIMIT_PER_MINUTE`) applies to `/api/v1/auth/login` and `/api/v1/auth/refresh`, marked with `@AuthRateLimit()`. The throttler guard runs **before** authentication, so unauthenticated floods are limited too.
- Counters live in **Redis** (`RedisThrottlerStorage`, one atomic Lua script per hit), so limits hold across API replicas. If Redis is down the limiter fails open and logs a warning, so a cache outage never blocks real users.
- Health probes are exempt.

**Graceful shutdown**

- On `SIGTERM` or `SIGINT`, readiness flips to 503 so load balancers stop sending traffic, idle keep-alive connections close, and `app.close()` runs. That stops the HTTP server and lets in-flight requests finish, lets the BullMQ worker finish its active job, and closes the PostgreSQL and Redis connections.
- A hard deadline (`SHUTDOWN_TIMEOUT_MS`) forces exit with code 1 if anything hangs. A second signal exits immediately.
- The worker process uses the same handler.

**Health probes**

- `GET /health/live`: the process is up.
- `GET /health/ready`: PostgreSQL and Redis respond and the process is not shutting down; otherwise 503 with per-dependency status.

**Development vs production**

| | development | production |
|---|---|---|
| Logs | Coloured, includes `debug`/`verbose` | **JSON**, `log` and above |
| Swagger `/docs` | On | Off unless `SWAGGER_ENABLED=true` |
| CORS | Allow-list, or any `localhost` port if empty | Allow-list only, https origins |
| HSTS | Off | On (180 days) |
| 5xx response | Adds `debug` (error name + message) | Generic message only |
| Config validation | Schema | Schema **plus** production rules: no wildcard or plain-http CORS origins, no simulated vendor failures, bcrypt cost ≥ 12 |

---

## Application lifecycle

```
DRAFT ──submit──▶ SUBMITTED ──risk ok──▶ UNDER_REVIEW ──approve──▶ APPROVED
  ▲                  │                       │    └─────reject──▶ REJECTED
  │                  │ retries exhausted     └──request info──▶ INFO_REQUESTED
  │                  ▼                                                │
  │             RISK_FAILED ──submit (retry)──▶ SUBMITTED ◀──submit───┘
```

- All transitions are defined in one table, `src/modules/applications/domain/application-state-machine.ts`. Every status change goes through `transition()`, so an illegal move throws (`409`) instead of being written.
- Applications are editable only in `DRAFT` and `INFO_REQUESTED`. `APPROVED` and `REJECTED` are terminal.
- A reviewer can only decide once the risk review has completed (`UNDER_REVIEW`).
- Decision rules (`review-decision.rules.ts`): `REJECT` and `REQUEST_INFO` require a note, and approving a `HIGH`-risk merchant requires a written justification.
- Each submit increments `submissionCount`. A resubmission gets a fresh risk review, and the previous decision is cleared; its history remains in the audit trail.
- Risk is tracked separately in `riskStatus`: `NOT_STARTED → PENDING → LOW | MEDIUM | HIGH | ERROR`.

---

## Authorization model

There are three layers, each with one responsibility:

1. **Authentication.** A global `JwtAuthGuard` protects every route, so routes are secure by default; `@Public()` opts out. Access tokens are HS256 only (rejecting `alg: none`) and live 15 minutes. On every request the user's current role and status are resolved from the database through a short-lived cache, so deactivating a user or changing their role through `PATCH /api/v1/users/:id` takes effect on the very next request.

   **Refresh tokens** are opaque random values (256 bits), not JWTs, so they can be revoked:
   - Only a SHA-256 hash is stored. A database leak does not expose usable tokens, and a fast hash is enough because the token has full entropy (unlike a password).
   - **Rotation:** every `/api/v1/auth/refresh` returns a new refresh token and retires the old one, which is linked to its replacement.
   - **Reuse detection:** all tokens from one login form a *family*. Presenting a retired token means it was copied, so the whole family (session) is revoked and both the attacker and the victim must log in again. Two concurrent refreshes with the same token are treated the same way: exactly one succeeds.
   - Refreshing also re-checks that the user is still active. Logout revokes the family and always answers `204`, so it reveals nothing.
   - Other sessions of the same user (other devices) are unaffected.

   **Access-token denylist.** Revoking a refresh token alone would leave the session's access token usable until it expires (up to 15 minutes). To close that gap:
   - Every access token carries `sid` (the session, i.e. the refresh-token family) and a unique `jti`. Tokens without them are rejected.
   - Logout, logout-all and reuse detection write `denylist:session:<sid>` to Redis. `JwtStrategy` checks it on every request, so every access token issued for that session stops working on the next request, including older ones.
   - The denylist is keyed by **session, not by token**: one entry blocks every access token the session ever issued, and nothing needs to know their `jti`s.
   - Each entry expires after the access-token lifetime plus 60 s of clock skew. After that, every token it could block has expired by itself, so the denylist never grows beyond the number of sessions revoked in the last ~16 minutes.
   - **PostgreSQL stays the source of truth.** If Redis cannot be read, the check falls back to `refresh_tokens` (indexed by `family_id`), so a Redis outage neither lets revoked tokens through nor logs everyone out. Redis runs with `maxmemory-policy noeviction`, so it never silently drops entries under memory pressure.
   - User deactivation and role changes do not need the denylist: the per-request principal check already handles them.
2. **Roles.** A global `RolesGuard` reads `@Roles(...)` on each route, e.g. only ADMIN can assign.
3. **Object-level policy.** `ApplicationAccessPolicy` checks the loaded application against the caller:
   - SALES can view and modify only applications they created. Anything else returns **404, not 403**, so IDs cannot be probed to find out what exists.
   - Only the **assigned** REVIEWER can record a decision. ADMIN cannot either; this follows the specification literally and keeps the four-eyes rule.
   - Listing applies the SALES filter **in the SQL query**, so pagination totals cannot leak other users' data.

The policy is plain TypeScript with no framework dependency. It is unit-tested exhaustively, and `test/authorization.e2e-spec.ts` attacks it end to end.

---

## Asynchronous risk review

```
POST /submit ──▶ [tx: status=SUBMITTED, submissionCount++, audit] ──commit──▶ queue.add(jobId=assess-<id>-<n>)
                                                                                   │
worker: load app ─▶ still SUBMITTED on submission n? ─▶ call KYB provider (no tx) ─▶ [tx: SELECT … FOR UPDATE,
        re-check, INSERT risk_assessment ON CONFLICT DO NOTHING, status=UNDER_REVIEW, audit] ─▶ commit
```

**Reliability**

- Jobs are enqueued **after** the transaction commits, so a worker never sees a submission that could still roll back.
- Retries use exponential backoff (`RISK_JOB_ATTEMPTS`, `RISK_JOB_BACKOFF_MS`). Transient vendor errors and unexpected errors (e.g. the database) are retried. A vendor error marked permanent stops immediately (`UnrecoverableError`).
- When retries run out, the application moves to `RISK_FAILED` with `riskStatus=ERROR` and an audit entry. The owner or an ADMIN can resubmit.
- The vendor call happens **outside** any transaction, so no row lock is held across network I/O.
- **Reconciler:** a BullMQ job scheduler runs every 60 s and re-enqueues submissions stuck in `SUBMITTED` for more than 10 minutes. This covers the window where the commit succeeded but Redis was unavailable for the enqueue.
- API and worker are the same image with different entry points (`main.ts` / `worker.ts`), so they scale independently. Compose runs them as separate services.

**Idempotency (layered)**

1. A deterministic job ID (`assess-<applicationId>-<submissionNo>`) means a duplicate enqueue is a no-op in BullMQ.
2. The worker acts only if the application is still `SUBMITTED` **and** on the same submission number. This is re-checked under a row lock, so late, duplicate or concurrent deliveries are skipped.
3. A unique constraint on `risk_assessments(application_id, submission_no)` plus `ON CONFLICT DO NOTHING` means the database itself cannot hold two results for one submission.
4. The vendor receives an idempotency key (`<applicationId>:<submissionNo>`), so a retried call is not billed twice by a real provider.

The vendor is a port (`RiskProvider`) with a deterministic simulated adapter. Scores are derived from a hash of the legal name and tax ID, adjusted for high-risk MCCs, volume and business type. Latency and transient failures can be configured to show retries working.

---

## Data model

| Table | Purpose | Key constraints / indexes |
|---|---|---|
| `users` | Staff accounts | unique `email`, `CHECK (email = lower(email))`, `password_hash` excluded from default selects |
| `merchant_applications` | Applications | FKs to `users` (creator, reviewer, decider), `version` column, checks on score range, amounts and decision-field consistency. Indexes: see below |
| `risk_assessments` | One result per submission | `UNIQUE (application_id, submission_no)`, score/level checks |
| `audit_logs` | Append-only trail | index `(entity_type, entity_id, created_at)`; trigger rejects `UPDATE`/`DELETE` |
| `refresh_tokens` | Hashed refresh tokens | unique `token_hash`, indexes on `family_id` and `user_id`, checks on revocation fields |

- `synchronize` is never enabled. The schema exists only through `src/database/migrations`.
- The initial migration was generated from the entities and then reviewed: embedded column names were corrected, and check constraints, the partial index and the immutability trigger were added. Constraints are declared on the entities, so `migration:generate` reports no drift.
- Concurrency: every state-changing operation loads the row with `SELECT … FOR UPDATE` inside a transaction. Two simultaneous decisions on one application therefore serialise, and the second gets `409`. This is covered by a test.
- Monetary columns are `BIGINT` minor units, mapped to `number` through a transformer that refuses values outside the safe-integer range.

---

## Indexing and query performance

Each index exists for a specific query in the code:

| Index | Serves |
|---|---|
| `merchant_applications (created_at, id)` | ADMIN/REVIEWER list without filters, `ORDER BY created_at DESC, id DESC` |
| `merchant_applications (status, created_at)` | Status-filtered lists |
| `merchant_applications (created_by_id, created_at)` | SALES "my applications" list and its count; FK |
| `merchant_applications (assigned_reviewer_id, created_at)` | Reviewer `assignedToMe` queue; FK |
| `merchant_applications (decided_by_id)` | FK (avoids a full scan when a user row is checked for references) |
| `merchant_applications (submitted_at) WHERE status = 'SUBMITTED'` | Reconciler's stuck-submission scan. Partial, so it only holds the few in-flight rows |
| `risk_assessments UNIQUE (application_id, submission_no)` | Idempotency guard and lookup by application |
| `audit_logs (entity_type, entity_id, created_at)` | Audit trail of one application, in order |
| `users UNIQUE (email)` | Login |
| `refresh_tokens UNIQUE (token_hash)`, `(family_id)`, `(user_id)` | Refresh lookup, session revocation, per-user revocation |

Verified with `EXPLAIN ANALYZE` on 200,000 applications spread over 300 users:

| Query | Plan | Time |
|---|---|---|
| ADMIN list, first page | Index Scan Backward on `(created_at, id)` | 0.11 ms |
| Status filter, first page | Index Scan Backward | 0.21 ms |
| SALES own list | Index Scan Backward on `(created_by_id, created_at)` | 0.12 ms |
| Reviewer queue | Index Scan Backward on `(assigned_reviewer_id, created_at)` | 0.16 ms |
| Reconciler scan | Index Scan on the partial index | 0.62 ms |
| SALES page count | Bitmap Index Scan | 0.91 ms |

Pagination is offset-based, which is simple and fine for the first pages that people actually look at. Deep pages and `COUNT(*)` grow linearly; keyset (cursor) pagination on `(created_at, id)` is the next step, and the existing indexes already support it.

---

## Caching

Redis is already part of the stack for BullMQ, so the cache uses it as well, through a small `CacheService` (`src/common/cache`) that implements read-through (cache-aside) caching with TTLs.

| What | Key | TTL | Invalidation |
|---|---|---|---|
| Principal behind an access token (id, email, role) | `principal:<userId>` | 60 s | Evicted by `PATCH /api/v1/users/:id` in the same request |
| Active user list (`GET /api/v1/users?role=…`) | `users:list:<role>` | 300 s | All list keys evicted when a user is created or updated |

Design rules:

- **Correctness over hit rate.** Every write path that changes cached data evicts it explicitly. The TTL is only a safety net for changes made outside the API, such as manual SQL.
- **Fail open.** If Redis is unavailable, `CacheService` logs a warning and reads from PostgreSQL. A cache outage degrades latency, never availability. Commands fail fast (`enableOfflineQueue: false`, one retry) instead of queueing.
- **No negative caching.** "User not found or inactive" is never cached, so reactivation is visible immediately.
- **Not cached, on purpose:**
  - Merchant applications change state often, and every read needs an object-level authorization check against current data. Serving them from a cache risks stale status or a visibility leak, and the indexed reads take well under a millisecond anyway.
  - Refresh-token checks must be strongly consistent, so they always go to the database under a row lock.
- **HTTP caching is disabled** (`Cache-Control: no-store` on every response), so browsers and intermediaries never store responses that contain personal data.
- Hit, miss and error counters are exposed by `CacheService.stats`, ready to be exported as metrics.

---

## Audit trail and sensitive data

**Audited actions:** `APPLICATION_CREATED`, `APPLICATION_UPDATED`, `APPLICATION_SUBMITTED`, `REVIEWER_ASSIGNED`, `RISK_REVIEW_COMPLETED`, `RISK_REVIEW_FAILED`, `REVIEW_DECISION_RECORDED`, and `USER_UPDATED` (role or status changes, with before/after values).

- Each audit row is written **in the same transaction** as the change it describes, so the trail cannot disagree with the data.
- The worker writes rows with `actorId = null`, meaning the system performed the action.
- A database trigger makes `audit_logs` append-only.
- PostgreSQL holds the audit trail, as the brief allows. A dedicated store such as MongoDB, or a WORM bucket, is listed under next steps.

**Keeping secrets and personal data out**

- Passwords are hashed with bcrypt and never selected unless explicitly requested. Login compares against a dummy hash when the email is unknown, so response timing does not reveal which emails exist.
- All audit metadata passes through `redact()`. It removes keys such as `password`, `token`, `authorization` and `secret`, matched case- and separator-insensitively, and masks `taxId`, `bankAccountNumber`, `phone` and `email`.
- Updates are audited as a list of **changed field names**, never values.
- The request log records method, path, status, duration, request ID and user ID only. It never logs headers, query strings or bodies, which is where tokens and personal data leak.
- API responses mask `taxId` and `bankAccountNumber` to the last four characters.
- Server errors return a generic message; the stack trace is logged server-side only.
- `helmet` sets security headers. The validation pipe rejects unknown properties.

**Fields requiring field-level encryption in production**

| Field | Why |
|---|---|
| `merchant_applications.tax_id` | Government identifier; high value for identity fraud |
| `merchant_applications.bank_account_number` | Enables payment fraud; PCI-adjacent |
| `merchant_applications.owner_phone`, `owner_email`, `owner_full_name` | Personal data of a natural person (GDPR/CCPA scope) |
| `risk_assessments.provider_reference` | Links to the vendor's KYB dossier |

Proposed approach: envelope encryption, where a per-record data key (AES-256-GCM) is wrapped by a KMS key, implemented as a TypeORM column transformer. A separate HMAC "blind index" column would allow exact-match lookups (e.g. finding duplicate tax IDs) without decrypting. Key rotation re-wraps data keys without re-encrypting rows. It is not implemented here because the time-box did not allow it. The masking in the response DTO and in `redact()` is already the single exit point for these values, so adding encryption would not change the API.

All data in this repository and its tests is fictitious: `.test` domains, `555` phone numbers and placeholder tax IDs.

---

## Testing

```bash
docker compose up -d postgres redis   # integration tests need both
npm run test:unit                     # 147 tests, no I/O
npm run test:int                      # 108 tests against real Postgres + Redis + BullMQ
npm test                              # both
```

Integration tests boot the real `AppModule`, with the same validation pipe, guards and filter as production. They use a separate database (`DB_TEST_NAME`, created by Jest's global setup if missing) and an isolated queue prefix. The only thing replaced is the KYB vendor: `ScriptedRiskProvider` lets a test script failures and results.

| Suite | What it proves |
|---|---|
| `application-state-machine.spec` | Every status × action pair, allowed and forbidden (table-driven, with a completeness check) |
| `application-access.policy.spec` | View/modify/decide rules per role, 404-vs-403 behaviour |
| `review-decision.rules.spec`, `redact.spec`, `simulated-risk.provider.spec` | Business rules, redaction, scoring |
| `risk-review.processor.spec` | Retry vs give-up logic, permanent errors, reconciler |
| `cache.service.spec` | Read-through, TTL, no negative caching, eviction, fail-open when Redis is down |
| `error-mappers.spec` | Every mapper: domain errors, HTTP exceptions, each SQLSTATE class, network errors, body-parser errors, no leaking of internals |
| `flatten-validation-errors.spec`, `redis-throttler.storage.spec`, `lifecycle.spec`, `cors.spec`, `production-rules.spec` | Nested field paths; atomic rate limiting and fail-open; SIGTERM/SIGINT, second signal, deadline and fatal-error shutdown; origin matching; production config rules |
| `token-denylist.service.spec` | Entry TTL, Redis answer used when available, database fallback when Redis is down |
| `auth.e2e` | Login, uniform 401s, malformed/foreign/`alg:none` tokens, immediate effect of deactivation and role changes, principal served from cache, `no-store` header |
| `refresh-tokens.e2e` | Rotation, chains, reuse detection revoking the family, concurrent refresh race, per-device isolation, expiry, deactivated users, logout, hash-only storage, refresh token rejected as access token |
| `token-denylist.e2e` | `sid`/`jti` claims, logout kills current and older access tokens, other sessions unaffected, reuse detection kills the attacker's access token, logout-all, entry TTL, tokens without `sid` rejected |
| `error-handling.e2e` | Malformed JSON, 413, 415, unknown route, invalid UUID, nested validation details, generic 500 without leaks, database outage → 503 + `Retry-After`, request-ID propagation |
| `http-security.e2e` | CORS preflight and blocked origins, security headers, foreign issuer/audience rejected, liveness, readiness, readiness 503 during shutdown |
| `rate-limiting.e2e` | Login limit with `Retry-After`, global limit, health exempt, counters stored in Redis |
| `users-admin.e2e` | Cached reviewer list stays correct across create/deactivate, audit of user changes, self-lockout protection, ADMIN-only access |
| `authorization.e2e` | **Bypass attempts:** SALES reading/updating/submitting another user's application by ID, list isolation, identical 404 for foreign and missing IDs, mass assignment, role checks, unassigned reviewer and ADMIN decisions, reassignment revoking rights |
| `application-lifecycle.e2e` | Happy path with the audit trail, edit locking, invalid transitions, decision rules, request-info → resubmit, pagination/filters, masking, no sensitive values in the audit log, concurrent decisions |
| `risk-processing.e2e` | Result persistence, retry then success, exhaustion → `RISK_FAILED` → resubmit, permanent errors, duplicate enqueue, redelivery, concurrent delivery, stale submission, reconciler |

The suite was run repeatedly to confirm it is stable (no flaky timing).

---

## Trade-offs and next steps

**Deliberate choices**

- **NestJS 11 / TypeORM 0.3 rather than the newest majors.** These meet "NestJS 10+", are mature, and are widely documented. Upgrading is mechanical when needed.
- **Pessimistic row locks rather than optimistic versioning for transitions.** Contention on one application is low and the critical sections are short. Locks give simple, correct serialisation without retry loops in the client. The `version` column is still kept, so a future `If-Match` / ETag API is cheap.
- **Enqueue after commit + reconciler rather than a transactional outbox.** This gives the same eventual guarantee for this workload with less machinery. An outbox table is the next step if more event types appear.
- **404 for invisible resources.** This avoids revealing which records exist, at the cost of slightly less explicit errors for SALES users.
- **Audit in PostgreSQL.** It shares a transaction with the change, so it is consistent by construction.
- **Embedded owner contact.** One owner per application keeps the model simple. Real KYB needs multiple beneficial owners (a separate table).

**Next steps**

1. Field-level encryption (above) and secret management through a vault/KMS.
2. Account lockout on repeated failed logins; an absolute maximum session lifetime for refresh-token families; a scheduled purge of expired refresh tokens; a short grace window for benign concurrent refreshes from the same client.
3. Transactional outbox; dead-letter queue dashboard (Bull Board) and alerts on `RISK_FAILED`.
4. Webhook endpoint for asynchronous vendor callbacks (HMAC signature + idempotency key table).
5. Metrics (queue depth, job latency, failure rate) and OpenTelemetry tracing across API → queue → worker.
6. Beneficial owners as a separate table; document uploads; ETag-based optimistic concurrency on `PATCH`; keyset pagination for deep pages.
7. CI pipeline running lint, type-check, unit and integration tests, plus a migration drift check.
