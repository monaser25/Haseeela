# Decisions Log

## D001: Product Name

Decision: The product name is **Haseela**.

Impact:

- UI copy and portfolio docs should move toward Haseela.
- Internal legacy names can remain temporarily if renaming would risk behavior.

## D002: Platform Priority

Decision: Web first, mobile later.

Impact:

- No mobile app implementation until web is production-grade.
- HASEELA mobile files remain design reference only.

Status: Superseded by D008.

## D003: HASEELA Prototype Usage

Decision: HASEELA prototype is reference-only.

Impact:

- Do not copy prototype app architecture into production.
- Convert visual patterns into typed Next/React components.

## D004: Backend Scope For V1

Decision: V1 should focus on backend-supported MVP screens.

Impact:

- Invoices, reports, notifications, onboarding, pricing, and billing are deferred unless explicitly approved.

## D005: Agent Workflow

Decision: Use multiple agents with strict scopes and reports.

Impact:

- Plan agents can run in parallel.
- Build agents run in sequence for foundation work.
- Page agents can run in parallel only after foundation is approved and file ownership does not overlap.

## D006: Production Data Rule

Decision: No mock data in production screens.

Impact:

- Any HASEELA screen without backend support is not included as a live production feature.

## D007: Git Safety

Decision: No commits, force pushes, resets, or production deploy changes without explicit approval.

Impact:

- Agents should leave changes for review.
- Tech lead controls merges and release steps.

## D008: Mobile App Begins

Decision: The web app is considered stable; mobile app work starts now. Supersedes D002.

Goals:

- Presence on the App Store and Google Play.
- Real push notifications (overdue invoices, upcoming subscription renewals).
- Full offline editing with sync is out of scope.

Platforms and audience:

- iOS and Android from one codebase; Android ships first.
- Public product: in-app sign-up, verification, onboarding, and in-app account deletion.

V1 scope (backend-supported screens only):

- Auth, Onboarding, Home, Transactions, Clients, Subscriptions, Invoices, Notifications, Settings.
- Pricing and Billing stay out of scope, as on web (D004, D006).

Impact:

- Any API change must remain backward-compatible with the web app.
- HASEELA mobile files remain design reference only (D003).

## D009: Mobile Stack And UX Baseline

Decision: Build the mobile app with Expo (React Native) and TypeScript.

Why not the alternatives:

- Capacitor would have to load the server-rendered Next.js app from a remote URL, which risks App Store rejection as a thin web wrapper (guideline 4.2).
- Flutter shares no code with the TypeScript web app.

Impact:

- Arabic and English with full RTL support from day one.
- Verify and reset-password email links keep opening the web pages in V1; deep links / universal links come in V1.1.
- Offline: the last loaded data stays visible read-only with an offline banner; create and edit are disabled while offline.
- Invoices: view the PDF and share it through the native share sheet, in addition to the existing server-side send.
- Visual design follows the HASEELA mobile reference and the web's accessible colour tokens, converted to typed native components (D003). All mobile UI work applies the `ui-ux-pro-max` skill (React Native stack).

## D010: Mobile Repo Layout, Push, And Release

Decision:

- Code lives in `apps/mobile`; shared types, zod schemas, currency/format helpers, and translation messages move gradually into `packages/shared`, used by web and mobile. Moving code must not change web behaviour.
- Push: a `DeviceToken` table (user, token, platform), register/unregister endpoints, and sending through the Expo Push Service right after notifications are created, honouring the existing `notify*` preferences.
- API compatibility: changes are additive only (no removed or renamed fields). `api/health` exposes `minMobileVersion` to force an update when a break is unavoidable.
- Identity: store name "Haseela" with an Arabic subtitle; bundle id / package `com.haseela.app` (permanent after first release).
- Accounts: personal Apple Developer, Google Play, and Expo accounts. The plan allows for Google's 14-day closed test with 12 testers for new personal accounts.
- Release: EAS Build and EAS Submit, EAS Update for over-the-air fixes. CI gains mobile typecheck, lint, and test jobs (Jest + React Native Testing Library). Maestro E2E comes after V1.

## D011: Mobile React Version

Decision: The mobile app uses the latest Expo SDK with React 19, installed only in `apps/mobile`; the web app stays on React 18.

Impact:

- The monorepo holds two React versions; web must keep resolving React 18.
- Every mobile change must keep all web gates passing (typecheck, tests, lint, i18n check, build).
