# Backend Account Deletion Workflow & Recovery Architecture

## 1. Architectural Scope & Distributed Boundary Realities

In alignment with [DECISIONS.md](./DECISIONS.md) **D008** (public product supporting in-app account deletion across mobile and web) and **D010** (additive, backward-compatible backend integration), this document specifies the backend account deletion lifecycle for Haseela.

### Fundamental System Boundaries
- **No Distributed Atomicity**: Supabase Auth (external GoTrue service) and application finance records (PostgreSQL via Prisma ORM) are physically distinct data stores without two-phase commit. Distributed atomicity cannot be guaranteed.
- **Fail-Closed Intent**: Irreversible external Auth deletion must never precede durable database registration of deletion intent.
- **Monotonic DB Leases**: Both the client-facing `DELETE /api/user/delete` route and background maintenance in `/api/cron` execute a single unified workflow (`executeAccountDeletionWorkflow`) using DB-backed claim tokens and expiring leases (`leaseExpiresAt`) to prevent dual-runner conflicts or downgrading of completed states.

---

## 2. Technical Schema & Additive Model

An additive Prisma model persists deletion lifecycle metadata without foreign keys to `User`, enabling the user's workspace row to be deleted while preserving the deletion tombstone:

```prisma
model AccountDeletion {
  id             String    @id @default(uuid())
  userId         String    @unique
  status         String    @default("PENDING") // PENDING, AUTH_DELETED, COMPLETED
  isDev          Boolean   @default(false)
  attempts       Int       @default(0)
  lastErrorCode  String?
  ownerToken     String?
  leaseExpiresAt DateTime?
  completedAt    DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([status])
  @@index([status, leaseExpiresAt])
}
```

### Metadata Minimization & Error Code Taxonomy
- **Minimal Technical Metadata**: Stores only pseudonymous technical identifiers (`userId`, workflow status, attempt count, opaque error code, and lease tokens). No financial figures, client names, invoice items, email addresses, or credential strings are retained in `AccountDeletion`.
- **Persisted Error Codes (`lastErrorCode`)**: Persists only finite opaque failure states:
  - `AUTH_DELETE_FAILED`: Supabase Auth admin API returned an unexpected error or network rejection.
  - `FINANCE_CLEANUP_FAILED`: Prisma transaction failed during scoped workspace cleanup.
  - `MAX_RETRIES_EXCEEDED`: Job reached attempt cap (`attempts >= 5`) during cron maintenance.
- **API-Only Error Codes**: Returned in transient HTTP error responses for client dispatch, never written to `lastErrorCode`:
  - `PERSISTENCE_FAILED`: Database failed to record or authoritatively locate durable intent.
  - `CLAIM_EXPIRED`: Active lease held by another runner (`409 Conflict`).
- Raw server exception messages containing emails, tokens, or query parameters are never stored in the database or exposed in responses.

### Row Level Security (RLS) Policy
- The migration explicitly runs `ALTER TABLE "AccountDeletion" ENABLE ROW LEVEL SECURITY;`.
- There are **no** `anon` or `authenticated` client policies created for this table. Client SDK access via Supabase REST is completely denied; access is restricted to the trusted backend connection (Prisma / service-role). RLS is not forced on the table owner.

---

## 3. Workflow State Machine & Fenced Cleanup Coordination

### ASCII Phase Diagram

```text
[Incoming DELETE / Cron Request]
                |
                v
       Authenticate Caller
                |
                v
       Durable Intent Check
  (Create with P2002 conflict re-read)
                |
                +----------------------------+
                |                            |
       (Already COMPLETED)           (Status != COMPLETED)
                |                            |
                v                            v
          Return { ok: true }         Acquire DB Lease Token
                                      (Conditional updateMany)
                                             |
                     +-----------------------+-----------------------+
                     |                                               |
             (Claim Failed / Race)                           (Claim Granted)
                     |                                               |
                     v                                               v
        Poll briefly for COMPLETED                      Check Stored Provenance (isDev)
           / Return 409 Conflict                                     |
                                                     +---------------+---------------+
                                                     |                               |
                                                (Real User)                      (isDev = true)
                                                     |                               |
                                           Supabase deleteUser                 Skip Auth Admin
                                           (Validate user_not_found)                 |
                                                     |                               |
                                           Advance to AUTH_DELETED <-----------------+
                                                     |
                                           Atomic Fenced Transaction
                                           - Lease write fence (row lock)
                                           - Scoped financial deletions
                                           - Commit COMPLETED & release lease
                                                     |
                                                     v
                                            Return { ok: true }
```

### Atomic Fenced Cleanup Architecture
- **Single Unified Runner**: Both `DELETE /api/user/delete` and cron retry call `executeAccountDeletionWorkflow`.
- **Write Fence Row Lock**: Before deleting any financial data, `executeFencedFinancialCleanupTransaction` executes a conditional update within the transaction:
  ```ts
  tx.accountDeletion.updateMany({
    where: {
      userId,
      ownerToken,
      status: 'AUTH_DELETED',
      leaseExpiresAt: { gt: now },
    },
    data: { leaseExpiresAt: renewedLease },
  });
  ```
  This update establishes a row write lock in PostgreSQL. If `fence.count === 0` (lease expired, stolen, or already completed), no deletes occur and the transaction aborts safely.
- **Atomic Commit**: All 10 scoped deletes and the transition to `COMPLETED` are committed within the SAME Prisma transaction. If a database error occurs, everything rolls back atomically to `AUTH_DELETED`.
- **Stale Worker Protection**: Error handlers check `where: { userId, ownerToken, status: { not: 'COMPLETED' } }`, ensuring that a late worker failure cannot overwrite or downgrade an already completed deletion or clear another owner's active lease.

---

## 4. API & Safeguard Contracts

### `DELETE /api/user/delete`
- **Seam**: Authenticates via `authenticateRequest(request, { allowPendingDeletion: true })`.
- **Success Contract**: `200 OK` with `{ ok: true }` only when external Auth is confirmed gone and financial cleanup is committed.
- **Additive Failure Contract**:
  Error responses preserve existing HTTP status codes and the `error` message string, while providing additive machine-readable metadata:
  ```json
  {
    "error": "Failed to delete authentication account",
    "code": "AUTH_DELETE_FAILED",
    "deletionPending": true
  }
  ```
  - `deletionPending`: `true` only if authoritative deletion intent is confirmed in the database; `false` if intent registration failed before persistence.
  - Status `409 Conflict` (`code: "CLAIM_EXPIRED"`): Active deletion lease held by another worker.
  - Status `502 Bad Gateway` (`code: "AUTH_DELETE_FAILED"`): External Auth removal failed; user may retry immediately with current session.
  - Status `500 Internal Server Error` (`code: "PERSISTENCE_FAILED"` or `"FINANCE_CLEANUP_FAILED"`): Database failure during intent registration or financial transaction.

### Fail-Closed Safeguards
- **Regular Authenticated Routes**: Any account having an `AccountDeletion` record (in any status, including exhausted attempts) is rejected (`403 Forbidden` if in-progress/exhausted, `401 Unauthorized` if completed).
- **Workspace Auto-Adoption (`ensureUser`)**:
  - Rejects recreation for marked IDs with `403 Forbidden`.
  - If a new user signs up with an email matching a deletion-pending workspace, `ensureUser` **never** cleans up or adopts the previous owner's data. It responds with `409 Conflict` until background maintenance finishes cleanup. Once cleaned up, the new ID provisions a fresh workspace.

### Daily Maintenance Cron (`/api/cron`)
- **Authentication**: Fails closed if `CRON_SECRET` is unset. The `x-vercel-cron` header alone is rejected. Valid `Authorization: Bearer <CRON_SECRET>` or `?secret=<CRON_SECRET>` required.
- **Active User Maintenance**: Excludes all users present in `AccountDeletion`. Runs recurring billing and reminder notifications for active users using real billing modules.
- **Durable Retry Runner**: Scans uncompleted jobs where `attempts < 5` in deterministic order (`orderBy: { createdAt: 'asc' }`). Uses stored `isDev` provenance to avoid calling live Auth for dev accounts. On cap reached (`attempts >= 5`), retains phase (`PENDING` or `AUTH_DELETED`) and records `MAX_RETRIES_EXCEEDED` without reopening access. Fences claim acquisition with `attempts < 5` on authoritative current DB state.

---

## 5. Failure Modes & Residual Concurrency Limits

| Failure Scenario | State | Resolution & Honest Limits |
| :--- | :--- | :--- |
| **Crash after Auth deletion before DB update** | User deleted in Supabase Auth; DB shows `PENDING`. | Retry/cron calls `deleteUser`. Code verifies absence using documented `user_not_found` code from GoTrue or admin `getUserById`. Advances to `AUTH_DELETED` and completes cleanup. |
| **Prisma cleanup transaction fails** | User deleted in Auth; DB shows `AUTH_DELETED`. | Transaction rolls back atomically; all 10 financial records remain intact. Cron background runner acquires expired lease and finishes cleanup without requiring user credentials. |
| **Supabase timeout ambiguity** | Network hangs during `deleteUser`. | Pending promise cannot release the lease until it settles or rejects. After lease expires (`leaseExpiresAt`), the next attempt queries `getUserById` / retries `deleteUser`. |
| **Concurrent in-flight requests** | Ongoing HTTP requests during deletion request. | **Residual race limit**: Requests already running before the deletion intent record is committed may read/write data until their database transaction settles (pre-checks in auth/ensureUser cannot abort already executing handlers). Once intent is committed, all subsequent requests fail closed. Scoped cascade deletion in the cleanup transaction ensures no orphaned records remain. |

---

## 6. Migration Status & Verification Boundaries

- **Additive Migration**: `apps/web/prisma/migrations/20260920000000_account_deletion/migration.sql`.
- **Status**: **NOT APPLIED** to any live database.
- **Client Generation**: Executed locally via `prisma generate`.
- **Test Configuration**: `apps/web/jest.config.js` was configured with ts-jest JSX transformation and shared module path mapping to support un-mocked execution of real recurring billing and notification helpers importing `@haseela/shared`.
- **Verification Limits**: Validated via unit/integration route tests using mock Prisma and Supabase boundaries. Real PostgreSQL row-level locks, foreign key cascade constraints under high concurrency, and live Supabase Auth network deletions are **unrun** against production infrastructure.
