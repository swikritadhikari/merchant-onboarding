# Architecture decision records

Short records of the decisions that shape this service. Each one lists the context, the decision and its consequences.

---

## ADR-001: Pure domain layer for lifecycle and authorization rules

**Context.** The brief's riskiest areas are invalid state transitions and object-level authorization bypasses. Rules spread across controllers and services are hard to review and easy to bypass by accident.

**Decision.** Put the state machine (`application-state-machine.ts`), the access policy (`application-access.policy.ts`) and the decision rules (`review-decision.rules.ts`) in plain TypeScript modules with no framework imports. Every status change must go through `transition()`, and every access check through `ApplicationAccessPolicy`.

**Consequences.**
- All rules are visible in three small files and are unit-tested exhaustively; the state-machine test enumerates every status × action pair.
- Services orchestrate (transactions, auditing, queues) but do not decide.
- Adding a status means changing one table plus its tests.

---

## ADR-002: Hide inaccessible applications as 404

**Context.** A SALES user requesting another user's application by ID must be refused. With a 403, an attacker could tell which IDs exist.

**Decision.** If the caller cannot *view* an application, every endpoint responds as if it does not exist (404 with the same message as a truly missing ID). A 403 is used only when the caller can see the resource but may not perform the action, e.g. a reviewer who is not the assignee.

**Consequences.** There is no enumeration oracle; a test asserts that foreign and missing IDs get identical responses. The cost is that error messages are slightly less explicit for SALES users.

---

## ADR-003: Only the assigned reviewer may decide; ADMIN may not

**Context.** The brief says "only the assigned REVIEWER may record a risk decision". ADMIN has "full operational access", which could be read as overriding this.

**Decision.** Apply the rule literally. ADMIN manages assignments but cannot decide. To change who decides, an ADMIN reassigns the application.

**Consequences.** This preserves separation of duties (four-eyes): the person who controls assignment cannot also approve. Reassignment takes effect immediately, which a test covers.

---

## ADR-004: Pessimistic row locks for state transitions

**Context.** Two requests can act on the same application at once (double-clicked approve, reviewer and worker at the same moment). Without coordination, both could read the same status and both could write.

**Decision.** Every state-changing operation, in both the API and the worker, runs in a transaction that loads the row with `SELECT … FOR UPDATE`, re-checks the rules, and writes.

**Alternatives.** Optimistic locking with the `version` column, plus client retries. This was rejected for now: it needs retry handling in every caller, while contention per application is tiny and critical sections are a few milliseconds.

**Consequences.** Concurrent requests serialise and the loser gets a clean 409; a test fires two decisions concurrently. The `version` column is kept, so ETag/`If-Match` can be added later without a migration.

---

## ADR-005: Enqueue after commit, plus a reconciler (instead of a transactional outbox)

**Context.** Submitting must both change the database and enqueue a job. Enqueueing inside the transaction risks the worker seeing uncommitted data, or a job existing for a rolled-back submission. Enqueueing after the commit risks losing the job if Redis is down.

**Decision.** Enqueue after the commit. If it fails, log the error and still return success. A scheduled reconciler job re-enqueues any application that has been `SUBMITTED` for more than 10 minutes. A deterministic job ID makes a re-enqueue harmless.

**Alternatives.** A transactional outbox table polled by a relay. It is more general, but adds a table, a relay process and cleanup, which is more than this single event type needs.

**Consequences.** Delivery is eventual: at worst a submission waits until the next reconciler pass. If more event types appear (webhooks, notifications), switching to an outbox is the natural next step.

---

## ADR-006: Layered idempotency for risk processing

**Context.** BullMQ delivers *at least once*: a job can run twice after a worker crash, a stalled-job recovery or a manual retry. Users can also resubmit.

**Decision.** Use defence in depth:
1. A deterministic job ID per (application, submission number).
2. The worker acts only while the application is `SUBMITTED` on that exact submission number, re-checked under a row lock.
3. A unique constraint `(application_id, submission_no)` with `INSERT … ON CONFLICT DO NOTHING`.
4. A vendor idempotency key per submission.

**Consequences.** Duplicate, late and concurrent deliveries are all no-ops, and each case has an integration test. The submission number also cleanly separates the risk results of a resubmitted application.

---

## ADR-007: Retry classification

**Context.** Not every failure deserves a retry. A timeout might succeed next time; "tax ID not found" will not.

**Decision.** `RiskProviderError` carries a `retryable` flag. Retryable errors, and any unexpected error such as a database blip, are retried with exponential backoff up to `RISK_JOB_ATTEMPTS`. A non-retryable error fails the application immediately and throws BullMQ's `UnrecoverableError`, so no further attempts are made. In both terminal cases the application moves to `RISK_FAILED`, and the owner or an ADMIN can resubmit.

**Consequences.** Permanent failures don't waste attempts or delay feedback, and transient failures recover by themselves.

---

## ADR-008: Audit in PostgreSQL, same transaction, append-only

**Context.** The brief allows PostgreSQL for audit logs. An audit trail that can disagree with the data, or be edited, has little value.

**Decision.** Write the audit row with the same `EntityManager` as the change. A database trigger rejects `UPDATE` and `DELETE` on `audit_logs`. Metadata is redacted before it is written. Updates record only the changed field names.

**Consequences.** The trail is consistent by construction and tamper-resistant at the application level. A DBA can still bypass it, so a production system would also ship audit rows to a write-once store.

---

## ADR-009: Same image, separate API and worker processes

**Context.** The API and the queue consumer have different scaling and failure profiles.

**Decision.** `AppModule.register({ withWorker })` decides whether the BullMQ consumer is loaded. `main.ts` (HTTP) and `worker.ts` (no HTTP) are two entry points into one build. Locally, the API runs the worker in-process for convenience. In Docker Compose they run as separate services.

**Consequences.** One artefact to build and version, with independent scaling and restarts.

---

## ADR-010: Library versions

**Context.** Newer major versions exist (NestJS 12, TypeORM 1.x, TypeScript 7). The brief requires NestJS 10+.

**Decision.** Use NestJS 11, TypeORM 0.3, BullMQ 5, TypeScript 5.9 and Jest 29. These are stable lines with mature documentation. The one moderate `npm audit` finding (`js-yaml` via `@nestjs/swagger`) is fixed with an `overrides` entry rather than a major upgrade.

**Consequences.** There is lower risk of fighting fresh breaking changes inside the time-box. Upgrading later is a contained task.

---

## ADR-011: Opaque, rotating refresh tokens with reuse detection

**Context.** Access tokens are short-lived (15 minutes) to limit the damage of a leak, so clients need a way to stay signed in. Refresh tokens are long-lived and therefore valuable to an attacker.

**Decision.**
- Refresh tokens are 256-bit random strings, **not JWTs**. A JWT cannot be revoked before it expires; an opaque token is just a database lookup.
- Only the SHA-256 hash is stored. bcrypt is unnecessary because the token has full entropy, so it cannot be brute-forced the way a password can.
- Each refresh **rotates** the token: the old one is marked `ROTATED` and linked to its replacement.
- All tokens from one login share a `family_id`. Presenting a token that was already rotated means two parties hold it, so the entire family is revoked (`REUSE_DETECTED`).
- Rotation runs in a transaction with a row lock on the presented token. Its outcome is returned as a value, so the revocation commits before the 401 is sent.
- Refreshing re-checks that the user is active. Logout revokes the family and always returns 204.

**Consequences.** A stolen refresh token works at most once before both sessions are killed, and the event is logged. A client that sends two refreshes in parallel with the same token is logged out. That is the strict, standard behaviour, and a short grace window could relax it if real clients need one. Not yet done: an absolute session lifetime cap and a purge job for expired rows.

---

## ADR-012: Cache only what is hot, cheap to invalidate, and safe to be briefly stale

**Context.** The JWT strategy loads the user on every authenticated request, which makes it the hottest query in the system. The reviewer list is read often and changes rarely. Applications are read often too, but they change state constantly and are protected by object-level rules.

**Decision.**
- Use a Redis read-through cache (`CacheService`) for the principal (60 s TTL) and for user lists (300 s TTL).
- Evict on every write path that changes them, in the same request after the commit. The TTL is only a backstop for out-of-band changes.
- Do not cache negative results. Fail open to the database if Redis is down.
- Do not cache applications or refresh-token state.
- Send `Cache-Control: no-store` on every response.

**Alternatives.**
- An in-process memory cache. It is faster, but each API replica would hold its own copy, so an eviction on one replica would not reach the others.
- Caching application reads. Rejected: the risk of serving a stale status or leaking visibility outweighs a sub-millisecond indexed read.

**Consequences.** The hot path avoids a database round trip on most requests, and authorization changes made through the API still apply immediately. A change made directly in SQL can take up to 60 seconds to apply, which is documented and covered by a test.

---

## ADR-013: Index for the queries the code actually runs

**Context.** Lists are always sorted newest-first and are filtered by creator (SALES), by assignee (REVIEWER) or by status. The worker periodically scans for stuck submissions.

**Decision.**
- Create one composite index per access path, with the sort column second so PostgreSQL reads the first page straight from the index in order: `(created_at, id)`, `(status, created_at)`, `(created_by_id, created_at)` and `(assigned_reviewer_id, created_at)`.
- Index every foreign key column.
- Use a partial index on `submitted_at WHERE status = 'SUBMITTED'` for the reconciler, so it stays tiny.
- Use unique indexes for the invariants: email, token hash, and one assessment per submission.
- Verify with `EXPLAIN ANALYZE` on 200,000 rows. Every list query plans as an index scan and runs in under 1 ms.

**Consequences.** Writes maintain a handful of extra indexes, which is acceptable for a read-heavy back-office workload. Offset pagination and `COUNT(*)` still grow with page depth; keyset pagination is the next step and needs no new index. While reviewing the generated migration, I found that TypeORM's `down()` recreated an index with its columns in the wrong order. It was corrected by hand, which is why generated migrations are always reviewed.

---

## ADR-014: Session-scoped access-token denylist

**Context.** Access tokens are stateless JWTs. After logout or refresh-token reuse detection, the session's refresh token is dead, but its access token would remain valid for up to 15 minutes. Deactivation and role changes are already enforced per request (ADR-012), so this gap only concerns session revocation.

**Decision.**
- Add `sid` (refresh-token family ID) and `jti` claims to every access token, and reject tokens that lack them.
- On logout, logout-all and reuse detection, write `denylist:session:<sid>` to Redis with TTL = access-token lifetime + 60 s.
- `JwtStrategy` rejects any token whose session is denied.
- When Redis cannot be read, fall back to `refresh_tokens` in PostgreSQL, which is the source of truth.
- Run Redis with `maxmemory-policy noeviction`.

**Alternatives.**
- *Per-token (`jti`) denylist.* This requires knowing every outstanding `jti` of a session at revocation time, or storing them all. Keying by session blocks them all with one entry.
- *Shorter access tokens instead (e.g. 1 minute).* This shrinks the window but doesn't close it, and multiplies refresh traffic.
- *Database check on every request.* This is always correct, but puts a query on the hot path that Redis answers in microseconds. It is kept only as the fallback.
- *Fail closed (reject everything when Redis is down).* This turns a cache outage into a full outage. The database fallback gives correctness without that cost.

**Consequences.**
- Revocation is effective on the next request, and the denylist's size is bounded by the number of revocations in the last ~16 minutes.
- Remaining window: a Redis write that fails while subsequent Redis reads succeed (a brief flap) could miss an entry. The failure is logged at error level for alerting. Moving the check fully to the database would remove even this window, at the cost of one indexed query per request.

---

## ADR-015: Repository pattern with an ambient transaction

**Context.** Services were mixing business rules with TypeORM details (`DataSource.transaction`, `EntityManager`, lock options, query builders), and the audit service needed an `EntityManager` passed in to join the caller's transaction. That couples business code to the ORM and makes transaction boundaries easy to get wrong.

**Decision.**
- Each aggregate gets a repository class (`UsersRepository`, `ApplicationsRepository`, `RefreshTokensRepository`, `RiskAssessmentsRepository`, `AuditRepository`) extending `BaseRepository<T>`. All queries live there.
- `TransactionService.run(work)` opens a transaction and keeps its `EntityManager` in `AsyncLocalStorage`. Repositories always resolve the current manager from it, so every repository call made inside `run()` participates in the same transaction without passing anything around. Nested `run()` calls reuse the outer transaction.
- Methods that take row locks call `assertInTransaction()` and fail loudly if used outside a transaction.

**Alternatives.**
- *Passing `EntityManager` through method parameters.* Explicit, but it leaks the ORM into every service signature.
- *A library such as `typeorm-transactional`.* It does the same thing with more surface area and monkey-patching; about 25 lines of our own code are easier to read and reason about.

**Consequences.** Services read as business flow. Repositories are the single place to tune or review SQL. Switching the persistence technology for one aggregate touches one class.

---

## ADR-016: Folder-per-concern layout, barrels, and strict typing

**Context.** As the codebase grew, DTOs, entities, enums and helpers accumulated at module roots, and many functions relied on inferred types.

**Decision.**
- Module roots contain only the module, controller, service and repository files. Everything else goes into concern folders, each with an `index.ts` barrel, and imports go through barrels.
- Barrels are per folder rather than per module, which keeps import graphs shallow and avoids the load-order cycles that whole-module barrels tend to create between entities and services.
- TypeScript runs the full `strict` family plus `noUncheckedIndexedAccess`. ESLint uses `strictTypeChecked`, with explicit return types and accessibility, type-only imports and exhaustive `switch`es.

**Consequences.** Files are easy to find by convention, public surfaces are explicit, and whole classes of mistakes (unchecked index access, missing `await`, `any` leaking from libraries, spreading class instances) are compile-time or lint-time errors. The cost is some ceremony (definite-assignment `!` on entity and DTO fields, explicit mappers), which is acceptable for a long-lived service.

---

## ADR-017: One error contract, resolved by a chain of mappers

**Context.** Errors came from many places: domain rules, Nest exceptions, class-validator, the JSON body parser (which runs before Nest's exception filters), PostgreSQL and network failures. They produced inconsistent shapes, class names as error identifiers, leaked parser messages, and 500s for conditions that are really 400, 413 or 503.

**Decision.**
- A single `ErrorCode` enum and one code → HTTP status table.
- `resolveError()` tries small pure mappers in order (domain, HTTP, body-parser, database by SQLSTATE, network) and falls back to a generic 500.
- The same resolver and response writer serve the Nest global filter and an Express error middleware, so every error has the same JSON shape and request ID.
- Validation errors carry structured, dotted-path `details`.
- Transient infrastructure failures return 503 with `Retry-After`.
- Server-side messages never reach clients (except a `debug` field in development only).

**Consequences.** Clients can switch on stable codes. Operators get one log line per failure, at a severity that matches, correlated by request ID. Adding a new failure type means adding a mapper and a unit test.

---

## ADR-018: Redis-backed rate limiting, graceful shutdown, and environment profiles

**Context.** In-memory throttling does not hold across replicas. Default signal handling cut off in-flight requests and jobs. Development and production behaved identically (Swagger exposed, colourful logs, no HSTS).

**Decision.**
- `@nestjs/throttler` with a custom `RedisThrottlerStorage`, using an atomic Lua script per hit and failing open on Redis errors. There is a global per-IP limit and a stricter limit on authentication routes, and the guard runs before authentication.
- A single lifecycle handler covers `SIGTERM`/`SIGINT` and fatal errors. It marks the process not-ready, closes idle connections, closes the app gracefully, and enforces a hard deadline; a second signal exits immediately. Liveness and readiness probes are exposed for orchestrators.
- `NODE_ENV` drives behaviour explicitly: JSON logs, Swagger off, HSTS and strict CORS in production, plus additional configuration rules enforced at boot.

**Consequences.** Limits are consistent cluster-wide, deploys do not drop requests or half-process jobs, and a misconfigured production deployment fails at startup instead of running unsafely.

---

## ADR-019: URI versioning under /api/v1

**Context.** Clients (a back-office UI, partner integrations) need a stable contract. A future breaking change, such as a new decision payload or a renamed field, must not break existing consumers.

**Decision.** A global `api` prefix plus Nest URI versioning with default version `1`, so routes are `/api/v1/...`. A breaking change ships as a `@Version('2')` handler or controller next to v1, and v1 is retired on a published schedule. Health probes are excluded from the prefix and marked `VERSION_NEUTRAL`, because orchestrators need a path that never changes. Swagger stays at `/docs`.

**Alternatives.** Header or media-type versioning keeps URLs clean, but is harder to see in logs, caches and browser tools. URI versioning is the most explicit option and the easiest to route at a gateway.

**Consequences.** Every client URL includes the version. A test pins the contract: unprefixed and unknown-version paths return 404, and health stays unprefixed.
