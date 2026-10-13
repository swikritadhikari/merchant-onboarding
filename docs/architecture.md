# Architecture

This document explains how the code is organised and why. The [README](../README.md) covers behaviour, setup and the API.

## Project structure

Feature modules live under `src/modules/`. Shared infrastructure (`common/`, `config/`, `database/`, `bootstrap/`) sits beside them and never depends on a feature module's services. Every feature module follows the same layout. Only the module, controller, service and repository files sit at the module root. Everything else lives in a purpose-named folder that exposes its contents through an `index.ts` barrel, and imports always go through the barrel (`from './dto'`, `from '../users/enums'`).

```
src/modules/<feature>/
├── <feature>.module.ts        Nest wiring
├── <feature>.controller.ts    HTTP surface: routes, roles, OpenAPI, DTO ↔ response mapping
├── <feature>.service.ts       Business flow: transactions, policy, state machine, audit
├── <feature>.repository.ts    All persistence for the aggregate (the only place that queries)
├── constants/                 Named constants, cache-key builders, injection tokens
├── domain/                    Pure business rules (no Nest, no TypeORM)
├── dto/                       Request validation and response shapes
├── entities/                  TypeORM entities (and embedded value objects)
├── enums/                     Enumerations
├── interfaces/                Typed contracts (inputs, results, filters)
├── mappers/                   Explicit DTO ↔ entity mapping
└── utils/                     Small pure helpers
```

```
src/
├── main.ts / worker.ts        Entry points: HTTP API, or worker-only application context
├── app.module.ts              AppModule.register({ withWorker }); global guards, filter, interceptor
├── bootstrap/                 HTTP pipeline (helmet, no-store, ValidationPipe), Swagger, worker flag
├── config/                    validation/ (env schema), interfaces/ (typed config), AppConfigService
├── database/                  DatabaseModule, TransactionService, base/BaseRepository,
│                              config/ (TypeORM options), cli/ (data source), migrations/, seeds/
├── common/                    cache/, decorators/, dto/ (pagination), errors/, filters/, guards/,
│                              interceptors/, interfaces/, middleware/, security/ (redaction),
│                              transformers/, utils/
└── modules/                   Feature modules
    ├── auth/                  AuthService, RefreshTokenService, TokenDenylistService,
    │                          RefreshTokensRepository, strategies/, entities/, dto/, ...
    ├── users/                 UsersService, UsersRepository, entities/, enums/ (Role), dto/, ...
    ├── applications/          ApplicationsService, ApplicationsRepository, domain/, mappers/, ...
    ├── risk/                  RiskModule (producer side): producers/
    │                          RiskWorkerModule (consumer side): processors/, providers/,
    │                          RiskReviewService, RiskAssessmentsRepository
    └── audit/                 AuditService, AuditRepository, entities/, enums/, ...
```

## Layering and the repository pattern

```
controller ──▶ service ──▶ domain (pure functions)
                  │
                  ├──▶ own repository ──▶ TransactionService.manager ──▶ PostgreSQL
                  ├──▶ other modules' services (UsersService, AuditService)
                  └──▶ RiskReviewProducer ──▶ Redis ──▶ RiskReviewProcessor ──▶ RiskReviewService
```

- **Only repositories talk to the database.** Services never import `DataSource`, `EntityManager` or `Repository`. Each repository extends `BaseRepository<T>` and exposes intention-revealing methods (`findByIdForUpdate`, `findPage`, `insertIfAbsent`, `revokeFamily`, ...), so query details such as locking, `ON CONFLICT` or `RETURNING` stay out of business code.
- **Transactions are ambient.** `TransactionService.run(work)` opens a transaction and stores its `EntityManager` in `AsyncLocalStorage`. Every repository resolves its TypeORM repository through `transactions.manager`, so any repository called inside `run()` (including another module's, such as `AuditRepository`) joins the same transaction automatically. Nested `run()` calls reuse the outer transaction.
- **Lock-taking methods guard themselves.** `findByIdForUpdate` calls `assertInTransaction()` and throws if it is used outside `run()`, because a `FOR UPDATE` outside a transaction would silently release the lock immediately.
- Cross-module data access goes through the owning module's **service** (e.g. `ApplicationsService` asks `UsersService.findActiveByIdAndRole` for a reviewer), not through another module's repository. The one exception is the risk worker, which updates applications through `ApplicationsRepository` (exported by `ApplicationsModule`), because it acts on that aggregate as a system process.
- `applications/domain` imports nothing from NestJS or TypeORM. The state machine, access policy and decision rules are plain functions over plain data.
- Module graph without cycles: `ApplicationsModule → RiskModule` (producer only). `RiskWorkerModule → ApplicationsModule + RiskModule + AuditModule` (consumer side).
- Domain errors (`InvalidStateTransitionError`, `AccessDeniedError`, …) carry no HTTP status; `AllExceptionsFilter` maps them.

## Type safety

- `tsconfig` runs `strict` plus `strictPropertyInitialization`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters` and `useUnknownInCatchVariables`. Entity and DTO fields use definite assignment (`!`) because TypeORM and class-transformer populate them.
- ESLint uses `typescript-eslint`'s `strictTypeChecked` and `stylisticTypeChecked` configs. On top of those it requires explicit return types and member accessibility, type-only imports (decorator-metadata aware, so DI-injected classes stay value imports) and exhaustive `switch`es, and bans `any`, floating promises and spreading class instances.
- Config, query results, job payloads, worker outcomes, token-rotation results and cache stats all have named interfaces or discriminated unions. The rotation and assessment results are unions that the compiler forces callers to narrow.
- DTO ↔ entity conversion is explicit (`mappers/`, `ResponseDto.from`). No `Object.assign` and no object spreads of class instances, so every copied field is listed and type-checked.

## Request pipeline

```
request
  → helmet
  → Cache-Control: no-store
  → RequestLoggingInterceptor (assigns x-request-id; logs method/path/status/duration/user only)
  → JwtAuthGuard (global; skipped only for @Public)
  → RolesGuard (global; reads @Roles)
  → ValidationPipe (whitelist + forbidNonWhitelisted + transform)
  → controller → service (transaction, row lock, policy, state machine, audit)
  → ResponseDto.from(entity) (explicit mapping; masks sensitive fields)
  → AllExceptionsFilter on any error (uniform JSON; 5xx details logged, never returned)
```

Guards are registered globally with `APP_GUARD`, so a new controller is protected by default. Forgetting a decorator therefore results in *too much* protection, not too little.

Responses are built by explicit `static from()` mappers rather than by serialising entities. A new column cannot leak through the API by accident; it has to be added to the DTO on purpose.

## Write path for a state change

Every mutation in `ApplicationsService` follows the same shape:

1. `transactions.run(async () => { … })` opens the transaction.
2. `applicationsRepository.findByIdForUpdate(id)` (`SELECT … FOR UPDATE`), then check visibility immediately. Callers who may not see the row get a 404 before anything else happens.
3. Check the object-level policy (`assertCanModify` / `assertCanDecide`).
4. Compute the next status with `transition()`. It throws if the move is illegal.
5. Apply the business rules (e.g. a note is required).
6. Save through the repository, and record the audit entry; `AuditRepository` joins the same transaction through `TransactionService`.
7. Commit. Side effects outside the database (enqueueing) happen only after the commit.

## Authentication and caching

```
login ──▶ access JWT (15 min, claims sub/role/sid/jti) + refresh token (opaque, 7 days, stored as SHA-256)
request ──▶ JwtStrategy.validate ──▶ sid denied? (Redis denylist ─(Redis down)─▶ refresh_tokens) ──▶ 401
                                └──▶ UsersService.findActivePrincipal ──▶ cache principal:<id> ─(miss)─▶ users table
logout / logout-all / reuse ──▶ revoke family in DB (commit) ──▶ SET denylist:session:<sid> EX access-TTL+60s
refresh ──▶ tx: SELECT refresh_tokens FOR UPDATE ──▶ unknown/expired/revoked → 401
                                               └──▶ already rotated → revoke family, commit, 401
                                               └──▶ valid → issue next token in same family, mark old ROTATED
PATCH /users/:id ──▶ tx: update + audit ──▶ evict principal:<id> and users:list:*
```

- `RefreshTokenService.rotate()` returns a result object instead of throwing. Throwing inside the transaction would roll back the family revocation that reuse detection just performed, so the 401 is raised by `AuthService` after the commit.
- The row lock on the presented token serialises concurrent refreshes. The second request sees the token already rotated and is treated as reuse.
- The principal cache stores only `{ id, email, role }`, never credentials. Eviction happens after the user update commits, so a concurrent request can never re-cache the old value from inside the transaction.
- The denylist is written **after** the database commit. Redis answers the hot-path check; when Redis can't be read, `CacheService.exists()` returns `undefined` (unknown) rather than `false`, and `TokenDenylistService` then asks PostgreSQL.
- `CacheService` gets its Redis client through a provider token. It is unit-tested with an in-memory fake, including the Redis-down path.

## Worker design

- `RiskReviewProcessor` handles only queue mechanics: which job type, whether this is the last attempt, whether the error is retryable. `RiskReviewService` holds the logic and can be called directly, which the idempotency tests do.
- `process()` reads `job.attemptsMade + 1` to know the current attempt. On the final attempt, or on a permanent error, it calls `markFailed()` before rethrowing. Doing this inside `process()` rather than in a `failed` event listener keeps it within the job's own lifecycle.
- The vendor call is made before the transaction opens. The transaction then re-reads the row under lock and re-checks that the job is still current. A slow vendor call therefore never holds a lock, and work that became stale while waiting is discarded.
- `upsertJobScheduler` registers the reconciler idempotently, so any number of worker replicas can start safely.
- `requeueAssessment()` removes a *failed* job with the same ID before re-adding it. Otherwise a job that exhausted its retries, but whose failure could not be written to the database, would block its own recovery forever.

## Configuration and entry points

- `AppModule.register({ withWorker })` decides whether `RiskWorkerModule` (the BullMQ consumer) is loaded. `main.ts` reads `RISK_WORKER_ENABLED` (defaults to on for local development). `worker.ts` always enables it and starts no HTTP server.
- `AppConfigService` is the only place that reads environment keys. The rest of the code receives typed, validated values.
- `buildTypeOrmOptions()` is shared by the app, the TypeORM CLI and the test harness, so all three use the same entity list, migrations directory and settings. `synchronize` is always `false`. UUIDs use PostgreSQL's built-in `gen_random_uuid()`, so no `CREATE EXTENSION` privilege is needed.

## Testing approach

- **Unit tests** sit next to the code (`*.spec.ts`) and cover the pure domain, redaction, provider scoring and the processor's retry decisions, with mocks.
- **Integration tests** (`test/*.e2e-spec.ts`) boot the real `AppModule`, including the worker, against real PostgreSQL and Redis. Only the vendor is replaced, with `ScriptedRiskProvider`. `TestApp` migrates the test database before boot, gives each process its own queue prefix, and between tests waits for in-flight jobs before draining and truncating. That ordering avoids deadlocks and stray retries.
- The asynchronous worker is awaited by polling the API (`waitFor`) rather than by sleeping for fixed times, which keeps the tests fast and deterministic.
