# Mobile V1 Engineering Handoff

- **Date:** 2026-10-01
- **Status:** Mobile V1 is not production-ready
- **Handoff Reason:** User requested engineering handoff in Arabic: *"شوف انت وقفت فين علشان هخلي كلود يكمل من وراك فسجل كدا انت وقفت فين وناقص ايه"*.
- **Next Operator:** Claude in a new session. This document conveys historical state only, NOT fresh verification or new authority.
- **Session & Goal Status:** The parent paused the original ZadLoop completion goal (goal phase paused, activation disarmed) following the human handoff request, rather than marking it complete. No autonomous continuation is queued or active.
- **Scope & Dirty State Snapshot:** 241 individual dirty files were recorded by the parent on 2026-10-01 20:30 (`git status --short --untracked-files=all`, where default `git status --short` displays 58 entries by grouping untracked directories). That count represents the historical snapshot prior to handoff document creation; all working tree changes are preserved and the parent made zero workspace code edits.

---

## 1. Where We Stopped & Immediate Next Action

1. **Current Stop State:** Finance attempt `attempt-a984a28f-f36c-436b-9ef8-da14ed629799` (delegation-11) concluded with `needs-attention`. The original finance attempt plus 4/4 corrections have been exhausted. Earlier Auth (`attempt-d6b66282-05bb-4f4f-9326-fe88dd9ae013`) and Backend Deletion (`attempt-4b82e85b-09a2-4888-9f78-9da6b1e48362`) tasks also exhausted their 4/4 correction attempts and concluded `needs-attention`.
2. **Current Session Status:** No background workers or native implementations are active. Failed tasks must not be rerouted or budget caps overridden within this ZadLoop session.
3. **Immediate First Action for Next Agent:**
   - Inspect the codebase, dirty working tree, and git metadata before touching code.
   - Do NOT run parallel heavy test gates.
   - First reproduce the isolated navigation failure in [subscriptions-list.test.tsx](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx#L184-L190) alone.
   - Trace causality strictly at approved public UI/HTTP/SDK boundaries without adding artificial timeouts or private mocks.

---

## 2. Scopes, Permissions, & Governance Boundaries

- **User Intent & Target Scope:** The user's original objective encompasses full Haseela V1: Authentication, Onboarding, Home Dashboard, Transactions, Clients, Subscriptions, Invoices, Notifications, Settings, Profile, In-App Account Deletion, Native Push Notifications, API Compatibility, and Store Release.
- **Latest Human Request Boundary:** The latest human request is exclusively documentation of handoff state. The parent asked permission to implement Native Push and `minMobileVersion`, but the user directed handoff instead. No new implementation task is queued or authorized.
- **Non-Granted Authorities:** No authority exists to commit, git push, open PRs, deploy to Vercel/cloud, execute live database migrations/SQL, perform remote EAS linking/builds/submits/updates, or wipe local devices/emulators.
- **Secrets & Credentials:** Live credentials and secrets must never be read or logged; never inspect live `.env.local`. Do not infer the absence of external credentials from repo absence.
- **Testing Seams:** The approved finance test scope was strictly limited to 4 paths ([mockServer.ts](../../apps/mobile/src/test/mockServer.ts), [mockServer.test.ts](../../apps/mobile/src/test/__tests__/mockServer.test.ts), [clients-tab.test.tsx](../../apps/mobile/src/app/__tests__/clients-tab.test.tsx), and [subscriptions-list.test.tsx](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx)). Testing must respect public UI, HTTP network boundaries, and Supabase client public contracts rather than mocking internal auth state or private QueryClient internals.
- **Subagent Runtime:** Built-in delegation applies only when running under ZadLoop. Fresh Claude sessions must follow their own system instructions and runtime governance rather than inheriting prior agent budgets.

---

## 3. Preserved Finance Test Outputs

The following preserved finance changes remain in the working tree (see Verification Record & Limitations below for status; isolated test gate is NOT passing):

- **[mockServer.ts](../../apps/mobile/src/test/mockServer.ts#L136-L173) (`createMockResponse`):**
  - Produces an immutable serialized JSON snapshot so later mutations to mock data objects do not leak across requests.
  - Raw empty or malformed strings properly reject `.json()` with `SyntaxError`.
  - Passing `undefined` data returns `undefined` (legacy contract preserved).
  - Passing `Uint8Array` or `ArrayBuffer` returns original buffer instances (binary support).
  - ArrayBuffer parsing behavior remains unchanged.
  - Validated by 8 unit test cases in [mockServer.test.ts](../../apps/mobile/src/test/__tests__/mockServer.test.ts#L1-L68).
- **[clients-tab.test.tsx](../../apps/mobile/src/app/__tests__/clients-tab.test.tsx#L40-L82):**
  - Typed `FinancialSnapshot` next-overview body observer with parse error reject + rethrow (simply observes actual wire JSON response and rejects/rethrows on parse error; no private cache probes or private cache patches).
  - Global `activeOverviewConsumer` is read during response body consumption (note: worker claimed per-request correlation, but observation is global).
  - Lines [L442-L522](../../apps/mobile/src/app/__tests__/clients-tab.test.tsx#L442-L522) verify exact request counts (`POST /api/clients/create` = 1, `DELETE /api/clients/delete/:id` = 1).
  - Deterministic temporal proof: withholds `/api/dashboard/overview` GET while mutation promise settles, demonstrating active row remains in UI until refetch body is consumed (proves mutation settlement != UI readiness).
  - Flagged anomaly: lines [L525-L527](../../apps/mobile/src/app/__tests__/clients-tab.test.tsx#L525-L527) duplicate the archived filter assertion already executed at [L510-L512](../../apps/mobile/src/app/__tests__/clients-tab.test.tsx#L510-L512); leave untouched for now.
- **[subscriptions-list.test.tsx](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx#L1-L501):**
  - Retains real AuthProvider, coherent SDK user fixture, and real `useIsOnline` network mock.
  - Monthly burden progression (45 -> 60 -> 85 -> 75) verified with exact PUT/POST/DELETE count of 1 and withheld overview GET barrier.
  - Contrary to prior subagent reports, no body consumer was added here; test directly awaits mutation promises after GET release.
  - All RTL, dark mode, offline banner, and navigation assertions preserved.
- **Causal Caveat on Hooks Asymmetry ([hooks.ts](../../apps/mobile/src/api/hooks.ts)):**
  - In [hooks.ts:48-53](../../apps/mobile/src/api/hooks.ts#L48-L53), `invalidateOverview` calls `queryClient.invalidateQueries` without returning a promise (returns `void`). In [useArchiveClient (hooks.ts:579-590)](../../apps/mobile/src/api/hooks.ts#L579-L590), `onSuccess` calls `invalidateOverview` without awaiting invalidation and does not mutate the cache directly. By contrast, [useArchiveSubscription (hooks.ts:651-668)](../../apps/mobile/src/api/hooks.ts#L651-L668) synchronously updates the cache via `setQueryData` and awaits `queryClient.invalidateQueries`.
  - The temporal held-GET proof demonstrates only that mutation promise completion != UI readiness; this hook asymmetry is NOT an established cause of the test flake. Superficially awaiting a `void` helper does not await refetch, and production hooks were NOT modified under the approved finance test scope.

---

## 4. Latest Parent Verification Record

Independent parent verification was executed on 2026-10-01. Results are logged below:

| # | Command | Result | Duration / Details |
|---|---|---|---|
| 1 | `npm test -w apps/mobile -- --runInBand src/test/__tests__/mockServer.test.ts src/app/__tests__/clients-tab.test.tsx src/app/__tests__/subscriptions-list.test.tsx` | FAILED (twice) | 33 passed, 1 failed (34.021s parallel; 17.577s isolated rerun). Failing test: `'navigates from More tab to /(app)/subscriptions'` at [subscriptions-list.test.tsx:187](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx#L184-L190). Lookup deadline for `more-subscriptions-link` expired despite link appearing in DOM dump. |
| 2 | `npm test -w apps/mobile -- --runInBand` | PASS | 41 suites, 436 passed in 72.925s. |
| 3 | `npx tsc --noEmit -p apps/mobile` | PASS | TypeScript clean; zero type errors. |
| 4 | `npm run lint -w apps/mobile` | PASS | 0 errors, 253 warnings (initial bare exit 1 repaired sequentially). |
| 5 | `node scripts/check-mobile-release.cjs --static` | PASS | Structural config checks passed; 3 expected unset PUBLIC env warnings. |
| 6 | Response snapshot probe (#6 below) | PASS | Confirmed snapshot immutability prevents in-place mutation bleed. |
| 7 | Empty JSON SyntaxError probe (#7 below) | PASS | Confirmed `.json()` rejects empty string with `SyntaxError`. |
| 8 | Binary Uint8Array passthrough probe (#8 below) | PASS | Confirmed Uint8Array binary response passes through unmodified. |
| 9 | Stress run 1 of 3 (#9 below) | PASS | 41 suites, 436 passed in 56.626s. |
| 10 | Stress run 2 of 3 (#10 below) | PASS | 41 suites, 436 passed in 62.576s. |
| 11 | Stress run 3 of 3 (#11 below) | PASS | 41 suites, 436 passed in 56.181s. |

### Verification Assessment & Limitations
- The 4 full test runs passing (1 full + 3 stress runs) DO NOT negate the isolated failure in [subscriptions-list.test.tsx](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx#L184-L190). Do not declare finance tests green or stable.
- Subagent reports claimed failures in [invoices-detail.test.tsx](../../apps/mobile/src/app/__tests__/invoices-detail.test.tsx#L135) (lines 135, 570, 707), but these were unverified worker reports that did NOT reproduce in parent's 4 full test runs; leave unowned tests untouched.
- 11 changed paths observed across runs, with 1 path unreadable; exact parent record cannot prove which entire tree state checks ran against.
- The 3 unset public environment variable warnings in `node scripts/check-mobile-release.cjs --static` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL`) refer strictly to the checking shell process environment, NOT proof that `.env` files are absent; never inspect `.env.local` contents.
- 9 PNG asset paths appeared as observed; no fresh hash comparisons were conducted and assets must NOT be reverted.
- Do not increase timeouts, add arbitrary sleep calls, or bypass test assertions to mask timing differences.

---

## 5. Unresolved Critical Code Blockers

### A. Mobile Auth & Session Invariants
- **Permissive Owner Fallback:** In [client.ts:168-178](../../apps/mobile/src/api/client.ts#L168-L178), missing authoritative user ID defaults to `initiatingOwnerId ?? 'sdk-unit-user'` when a token is present, instead of strictly rejecting unauthenticated requests.
- **Session Expiry Handling:** In [client.ts:42-75](../../apps/mobile/src/api/client.ts#L42-L75), `handleExpiredSession` destructures `data` only, ignoring SDK errors and missing users, and executes `signOut` outside the synchronized auth queue. Legacy mutators remain at [client.ts:379-493](../../apps/mobile/src/api/client.ts#L379-L493).
- **Unsynchronized Provider Queues:** In [AuthProvider.tsx:109-186](../../apps/mobile/src/auth/AuthProvider.tsx#L109-L186) and [AuthProvider.tsx:109-261](../../apps/mobile/src/auth/AuthProvider.tsx#L109-L261), only provider methods are queued; execution-time initiation re-checks are absent inside queued closures, leaving race windows.
- **Profile Screen Races:** In [profile.tsx:114-229](../../apps/mobile/src/app/%28app%29/profile.tsx#L114-L229), preflight error handling ([L139-L159](../../apps/mobile/src/app/%28app%29/profile.tsx#L139-L159)) resets `isSaving` without verifying all epoch/owner fences; line [L156](../../apps/mobile/src/app/%28app%29/profile.tsx#L156) unsafely accesses `preflightSession.user.id`; and `updateUser` at line [L165](../../apps/mobile/src/app/%28app%29/profile.tsx#L165) bypasses the shared auth queue.
- **Cache Cleansing & Epoch Fencing:** In [queryClient.ts:10-25](../../apps/mobile/src/query/queryClient.ts#L10-L25) and [queryClient.ts:55-75](../../apps/mobile/src/query/queryClient.ts#L55-L75), `ASYNC_STORAGE_PERSISTER_KEY = 'REACT_QUERY_OFFLINE_CACHE'` is shared globally without owner namespacing; `removeClient()` at [L64](../../apps/mobile/src/query/queryClient.ts#L64) executes unconditionally without sequence checking, unlike invoice PDF cache cleanup at [L69](../../apps/mobile/src/query/queryClient.ts#L69).
- **Core Security Invariant:** Invariant requires freezing `ownerId` and `sessionEpoch` BEFORE any asynchronous await, re-verifying before and after every SDK, HTTP, storage, callback, and navigation boundary (`undefined` = uninitialized, `null` = signed out, string = authenticated; token refreshes keep epoch; never invent placeholder identities).

### B. Web Backend Account Deletion & Concurrency
- **Transaction Fencing:** In [accountDeletion.ts:112-188](../../apps/web/src/server/accountDeletion.ts#L112-L188), deletion relies on an unexpired `AUTH_DELETED` lease (60s lease, max 5 attempts). Line [L178-L183](../../apps/web/src/server/accountDeletion.ts#L178-L183) handles `commit.count === 0` by returning ok if status is `COMPLETED` or throwing `CLAIM_EXPIRED`.
- **Missing Regression Tests:** In [account-deletion.test.ts:517-550](../../apps/web/src/server/account-deletion.test.ts#L517-L550), the rollback test verifies database error throws, but STILL lacks:
  1. A regression test verifying transactional rollback when `accountDeletion.updateMany` returns `{ count: 0 }` during final `COMPLETED` commit.
  2. A regression test for per-owner exactly-once cleanup counts across the 10 domain tables.
- **Schema & Migration Status:** Migration [migration.sql](../../apps/web/prisma/migrations/20260920000000_account_deletion/migration.sql#L1-L30) enables server-only RLS without client policies, but is NOT live applied. In-memory Map mocks do not prove Postgres transaction concurrency.
- **Ambiguous Response Boundary:** Returning `{ deletionPending: true }` does NOT prove deletion succeeded. If a network interruption occurs following DELETE, clients must not assume the account remains active.

---

## 6. Missing Native Features & Specification Contract

Inspected against current configuration in [package.json:14-54](../../apps/mobile/package.json#L14-L54) (Expo ~57.0.25, RN 0.86.3, React 19.2.3, RNTL 13.2.0):
- **Missing Direct Native/Release Dependencies:** `expo-notifications` (push notifications), `expo-updates` (over-the-air updates), and `expo-dev-client` (development builds) are completely absent from `dependencies` in [package.json:14-54](../../apps/mobile/package.json#L14-L54). Do not infer feature implementation or credential availability solely from repo dependency absence.
- **Missing Push & Versioning Logic:** No mobile code exists for `getExpoPushToken` or device registration. The backend has no `DeviceToken` model or Expo push client.
- **Missing Health Compatibility Check:** In [route.ts:1-11](../../apps/web/src/app/api/health/route.ts#L1-L11), `/api/health` executes `SELECT 1` and returns `{ status: 'ok', time }` only, with no `minMobileVersion` response.
- **Decisions Contract ([DECISIONS.md:76-127](./DECISIONS.md#L76-L127)):**
  - **D008/D009:** Android first, then iOS; email verify/reset links open web in V1; read-only offline cache without queued offline writes; native PDF viewing and share sheet.
  - **D010:** `DeviceToken` table + register/unregister endpoints; push notifications delivered via Expo Push Service honoring `notify*` preferences; additive `minMobileVersion` force update via `/api/health`; bundle id `com.haseela.app`; EAS Build/Submit/Update; Maestro post-V1. Note that Google Play's 14-day / 12-tester requirement was part of the historical D010 planning baseline; release engineers must verify then-current Google Play Console policies at release time.
  - **D011:** React 19 in `apps/mobile` and React 18 in `apps/web` must remain strictly isolated. Web gates must continue passing.
- **Push Security Architecture:** Device token registrations must enforce ownership fences against stale operations across users A and B. Push payloads must omit PII and restrict navigation to allowlisted routes. Do not claim push delivery readiness without physical hardware and FCM/APNs credentials.

---

## 7. Historical Local Acceptance Summary

The following milestones were verified locally in earlier runs but do NOT constitute whole-tree production readiness:
- **Mobile CI Pipeline:** Local checks in [check-mobile-release.cjs](../../scripts/check-mobile-release.cjs) and unit tests in [mobile-release-config.test.cjs](../../scripts/mobile-release-config.test.cjs) (32/32 tests pass) confirm mobile workflow integration in [.github/workflows/ci.yml](../../.github/workflows/ci.yml).
- **Brand Assets:** Canonical asset generation in [generate-mobile-brand-assets.py](../../scripts/generate-mobile-brand-assets.py) validated by [test_mobile_brand_assets.py](../../scripts/test_mobile_brand_assets.py) (22/22 tests pass), sourcing from [haseeela_icon.png](../../apps/web/public/haseeela_icon.png) while preserving legacy templates.
- **Unverified Production Gates:** Fresh whole-tree gates have NOT been executed across web TypeScript, full web test suites, web lint, i18n checks, web build, clean `npm ci`, remote GitHub Actions, live Supabase RLS/Auth/SMTP, live Postgres, APNs/FCM push delivery, app signing, physical Android/iOS devices, or Google Play's closed testing tracks.

---

## 8. Ordered Next Steps for Next Agent

1. **Working Tree Orientation:** Read dirty files, existing documentation, and package scripts. Preserve all existing uncommitted work across the dirty paths recorded in the snapshot.
2. **Reproduce Isolated Flake:** Run the isolated finance test command without background load to inspect the `more-subscriptions-link` deadline failure in [subscriptions-list.test.tsx:187](../../apps/mobile/src/app/__tests__/subscriptions-list.test.tsx#L184-L190).
3. **Falsifiable Boundary Investigation:** Require falsifiable phase evidence across HTTP, SDK, and public UI boundaries before making changes. Investigate without prejudging scheduler or production hook causes, and fix only the demonstrated root cause of the observed failure within the approved finance test scope.
4. **Harden Auth & Cache Fencing:** Fix identity fallbacks (`sdk-unit-user`), synchronize SDK auth calls through the shared queue, sanitize preflight user access in profile, and fence cache generation keys.
5. **Complete Deletion Regressions:** Add missing rollback regression tests for `accountDeletion.updateMany` returning `{ count: 0 }` and per-owner cleanup counts in [account-deletion.test.ts](../../apps/web/src/server/account-deletion.test.ts).
6. **Obtain Scope Authority for Push/Compat:** Prompt user for explicit authority before adding dependencies (`expo-notifications`), updating schema for `DeviceToken`, modifying `/api/health`, or altering native configuration.
7. **Run Verification Gates Sequentially:** Execute the full mobile and web test suites sequentially.

---

## 9. Rerunnable Commands Reference

### Mobile Verification Commands (Run in pwsh)
```pwsh
# 1. Isolated 3 finance test suites (currently failing in isolation)
npm test -w apps/mobile -- --runInBand src/test/__tests__/mockServer.test.ts src/app/__tests__/clients-tab.test.tsx src/app/__tests__/subscriptions-list.test.tsx

# 2. Full mobile test suite
npm test -w apps/mobile -- --runInBand

# 3. Mobile TypeScript check
npx tsc --noEmit -p apps/mobile

# 4. Mobile ESLint check
npm run lint -w apps/mobile

# 5. Mobile release static configuration check
node scripts/check-mobile-release.cjs --static

# 6. Probe: Snapshot immutability
npm exec tsx -- -e "import assert from 'node:assert/strict'; import { createMockResponse } from './apps/mobile/src/test/mockServer.ts'; (async()=>{const body={client:{name:'Before'}};const response=createMockResponse(200,body);body.client.name='After';const text=await response.text();const json=await response.json();console.log('Serialized body:',text);console.log('JSON body:',JSON.stringify(json));assert.deepEqual(json,{client:{name:'Before'}});})();"

# 7. Probe: Empty body SyntaxError rejection
npm exec tsx -- -e "import assert from 'node:assert/strict';import {createMockResponse} from './apps/mobile/src/test/mockServer.ts';(async()=>{await assert.rejects(createMockResponse(200,'').json(),SyntaxError);})();"

# 8. Probe: Binary Uint8Array passthrough
npm exec tsx -- -e "import assert from 'node:assert/strict';import {createMockResponse} from './apps/mobile/src/test/mockServer.ts';(async()=>{const bytes=new Uint8Array([1,2,3]);assert.deepEqual(await createMockResponse(200,bytes).json(),bytes);})();"
```

### Sequential Stress Test Runs
Stress test commands 9, 10, and 11 must each be invoked in their own separate fresh PowerShell process. Do not concatenate them in a single shell session because `exit $LASTEXITCODE` terminates that shell after the first command. Apply strict fail-fast: if ANY stress run fails, do not proceed to subsequent runs (e.g. if run 1 fails, do not run 2 or 3; if run 2 fails, do not run 3).

```pwsh
# 9. Stress run 1 of 3 (execute in fresh shell)
Write-Output 'Serial stress run 1 of 3'; npm test -w apps/mobile -- --runInBand; exit $LASTEXITCODE
```

```pwsh
# 10. Stress run 2 of 3 (execute in fresh shell only if run 1 passed)
Write-Output 'Serial stress run 2 of 3'; npm test -w apps/mobile -- --runInBand; exit $LASTEXITCODE
```

```pwsh
# 11. Stress run 3 of 3 (execute in fresh shell only if runs 1 and 2 passed)
Write-Output 'Serial stress run 3 of 3'; npm test -w apps/mobile -- --runInBand; exit $LASTEXITCODE
```

### Web & Shared Next Gate Commands
```pwsh
# Shared package typecheck
npx tsc --noEmit -p packages/shared

# Web package typecheck
npx tsc --noEmit -p apps/web

# Web package unit & integration tests
npm test -w apps/web -- --runInBand

# Web package linting
npm run lint -w apps/web

# Monorepo i18n translation key verification
npm run lint:i18n

# Web package production build (includes prisma generate and next build)
npm run build -w apps/web
```
