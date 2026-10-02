# Haseela Mobile Release & Deployment Guide

This document details the release preparation, EAS build workflows, environment constraints, and production readiness roadmap for **Haseela Mobile V1** (Expo SDK 57 / React Native 0.86 / React 19).

---

## 1. Monorepo Execution & Build Process

Haseela Mobile resides within an npm workspaces monorepo (`apps/*`, `packages/*`).

### Dependency Installation
All dependency management is centralized at the workspace root:
```bash
npm ci
```
*Never execute `npm install` directly inside `apps/mobile` to avoid desynchronizing `package-lock.json` or creating fragmented nested modules. Clean installation from root remains unverified by parent.*

### Workspace Commands
Tasks can be executed from the repository root using npm workspace arguments:
```bash
npx tsc --noEmit -p apps/mobile
npx tsc --noEmit -p packages/shared
npm run lint -w apps/mobile
npm test -w apps/mobile -- --runInBand
npm exec -w apps/mobile -- expo export --platform android --output-dir .export-ci-check
```

### EAS Build Execution
Following [Expo Monorepo Best Practices](https://docs.expo.dev/build-reference/build-with-monorepos/), EAS CLI commands must be executed with the mobile directory as the working directory:
```bash
cd apps/mobile

eas build --profile preview --platform android
eas build --profile production --platform android
eas build --profile production --platform ios
```

---

## 2. Build Profiles & Distribution Targets

Defined in `apps/mobile/eas.json`:

| Profile | Platform | Artifact Type | Distribution | Channel | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `preview` | Android | APK (`buildType: "apk"`) | `internal` | `preview` | Direct APK sideloading and internal testing |
| `production` | Android | AAB (`buildType: "app-bundle"`) | `store` | `production` | Google Play Store publication bundle |
| `production` | iOS | Archive / IPA | `store` | `production` | Apple App Store / TestFlight submission |

*Note on `developmentClient`: `expo-dev-client` is not a direct dependency in `apps/mobile/package.json`. Therefore, `developmentClient: true` is strictly disabled across all profiles to prevent broken native bootstrap.*

---

## 3. Versioning Strategy (`cli.appVersionSource: "local"`)

Haseela Mobile utilizes **local version authority**:

```json
{
  "expo": {
    "version": "1.0.0",
    "android": {
      "package": "com.haseela.app",
      "versionCode": 1
    },
    "ios": {
      "bundleIdentifier": "com.haseela.app",
      "buildNumber": "1"
    }
  }
}
```

### Auto-Increment & Version Bumping Rules
- Per [Expo App Version Documentation](https://docs.expo.dev/build-reference/app-versions/):
  - With `cli.appVersionSource: "local"`, build number and version code changes modify the local source files (`app.json`).
  - Automated or manual bumps must be reviewed and explicitly committed to version control by a human developer.
  - Remote or uncommitted auto-increments must not be relied upon in autonomous pipelines.
  - To read the runtime application version in code, the app should use `expo-application` (`Application.nativeApplicationVersion`, `Application.nativeBuildVersion`) rather than hardcoded configuration constants.

---

## 4. Environment Variables & Security Isolation

### Public Client Environment
Mobile binaries are public client artifacts. Anyone downloading the application can decompile and inspect bundled strings.

| Variable | Scope | Permitted Values | Forbidden Values |
| :--- | :--- | :--- | :--- |
| `EXPO_PUBLIC_SUPABASE_URL` | Public Client | Required valid HTTPS project URL | Localhost, loopback (`127.0.0.1`, `[::1]`), placeholder domains, embedded credentials |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public Client | Required public key: `sb_publishable_*` or legacy 3-part base64url JWT with `role: "anon"` | `sb_secret_*`, `service_role` keys, tokens with user `sub` claim, non-URL-safe characters |
| `EXPO_PUBLIC_API_URL` | Public Client | Required valid HTTPS API endpoint | Empty string, non-HTTPS protocols, loopback, embedded credentials |
| `EXPO_PUBLIC_EAS_PROJECT_ID` | Build / Cloud | Required valid UUID syntax for production builds (remote project linkage unverified locally) | Malformed UUID strings, non-UUID text |

### Secret Key Rejection Gate
The script `scripts/check-mobile-release.cjs` enforces that:
- Any key beginning with `sb_secret_*` is rejected.
- Any token or string containing `service_role` or `service-role` is rejected.
- Decoded JWT payloads with roles other than `'anon'` or containing a `sub` claim are rejected.
- Environment variables and diagnostic sentinel values are never printed in plaintext in failure outputs or logs.
- Dynamic config in `apps/mobile/app.config.js` does not parse `.env.local` or invent fake project UUIDs.
- Validation is structural and local: it verifies UUID syntax only; it does not verify remote key signatures, Supabase project linkage, or network connectivity.

---

## 5. Platform Store & Native Limitations

### Google Play Store Requirements (Android-First Path)
- **Personal Developer Account Tester Requirement**: For new personal developer accounts created after November 2023, Google requires at least **12 testers opted in continuously for at least 14 days** in a closed test before production track access is granted (see [Google Play Console testing guidelines](https://support.google.com/googleplay/android-developer/answer/14151465)).
- **Preview APK Path**: The `preview` profile enables building APKs that can be distributed directly to testers via Firebase App Distribution, Google Drive, or EAS internal distribution prior to closed testing on the Play Console.

### iOS App Store Preparation
- Apple Developer Team membership with valid distribution certificate and provisioning profiles.
- Privacy Nutrition Labels and permission strings in `Info.plist`.

### Expo Go & Remote Push Limitations
- Remote push notifications (via Apple APNs or Firebase FCM) **cannot** be fully verified inside standard Expo Go.
- Native build generation (`eas build`) with valid APNs keys / `google-services.json` is required for push verification.
- Credentials cannot be inferred absent from the repository alone and remain unverified.

### Over-The-Air (OTA) Updates Status
- `expo-updates` is **not** currently installed as a direct dependency in `apps/mobile/package.json`.
- Dynamic configuration in `apps/mobile/app.config.js` conditionally avoids configuring `updates.url` when `expo-updates` is absent.
- Native OTA runtime, channel branching, and rollback strategies remain **unverified**.

### Branding & Artwork Audit
- Generated Haseela assets are not stock; static image contracts are verified separately, but native presentation on physical devices remains unverified.

### Backend Deletion Endpoint
- The backend deletion endpoint has tests, but two required rollback/exactly-once regressions and live PostgreSQL proof remain unresolved. Backend deletion is settled in needs-attention status.

### Auth Review Scope
- Mobile auth flows are settled in needs-attention status following final correction (correction limits exhausted; worker not running).

---

## 6. Preflight Validation Scripts

### Local / CI Static Preflight
Validates file structures, package IDs, semver version formats, integer build numbers, `.gitignore` exclusions, Node engine compatibility, and secret hygiene:
```bash
node --test scripts/mobile-release-config.test.cjs
node scripts/check-mobile-release.cjs --static
```

### Production Preflight
Enforces syntactically valid HTTPS URLs, public anon/publishable keys, and EAS project ID UUID syntax (remote project association unverified locally):
```bash
node scripts/check-mobile-release.cjs --production
```

---

## 7. Status Table Truth

| Domain | Area | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Local Config** | Workspace Monorepo Setup | ✅ Prepared | Configured with root `npm ci`, workspaces `apps/*` and `packages/*` |
| **Local Config** | Mobile ESLint & TS | ✅ Prepared | `apps/mobile/.eslintrc.cjs` active with core/React-hooks; lint script added |
| **Local Config** | EAS Profiles (`eas.json`) | ✅ Prepared | `local` version source, `preview` (APK), `production` (AAB/iOS store) |
| **Local Config** | App Identifiers & RTL | ✅ Prepared | `com.haseela.app`, `versionCode: 1`, `buildNumber: "1"`, RTL en/ar active |
| **Local Config** | Git Ignore Rules | ✅ Prepared | Excludes `.expo/`, `.export-*`, `*.apk`, `*.aab`, `*.ipa`, credentials, `__pycache__` |
| **Local Config** | Release Check Script | ✅ Prepared | `scripts/check-mobile-release.cjs` (`--static` & `--production`) + tests |
| **Local Config** | CI Workflow | ✅ Prepared | `.github/workflows/ci.yml` Node 22, web gates with DB env, mobile gates |
| **Agent Gate** | `scripts/mobile-release-config.test.cjs` | ✅ Passed | 32 tests passed via `node --test` |
| **Agent Gate** | `scripts/check-mobile-release.cjs --static` | ✅ Passed | Structural check passed (0 errors, 3 env warnings for unset vars) |
| **Agent Gate** | `npm run lint -w apps/mobile` | ✅ Passed | 0 errors, 254 non-blocking warnings |
| **Agent Gate** | `npx tsc --noEmit -p apps/mobile` | ✅ Passed | 0 errors |
| **Agent Gate** | `npx tsc --noEmit -p packages/shared` | ✅ Passed | 0 errors |
| **Agent Gate** | `npm run lint:i18n` | ✅ Passed | Validated shared i18n dictionaries |
| **Agent Gate** | `npm test -w apps/mobile -- --runInBand` | ⚠️ Timing Sensitive | Full serial run is timing-sensitive: historical evidence includes intermittent failures in clients-tab (427/428 at line 404) and subscriptions-list (427/428 at line 456), alongside runs where all 40 suites / 428 tests passed (e.g. parent 54.53s run); isolated suite runs pass consistently |
| **Agent Gate** | `expo export --platform android` | ✅ Passed | Hermes bundle and assets generated into `.export-ci-check` |
| **Agent Gate** | Web Gates (`prisma validate`, `tsc`, `lint`, `test`, `build`) | ✅ Verified | Web pipeline preserved and verified; `prisma validate` has Postgres env |
| **External / Live** | Physical Device Execution (Android/iOS) | ❌ NOT RUN | Physical hardware testing not run |
| **External / Live** | Push Notifications (APNs / FCM) | ❌ UNVERIFIED | Push signing credentials and native entitlements unverified locally |
| **External / Live** | Live Backend / Supabase RLS / Auth | ❌ UNVERIFIED | Validated against local mocks/placeholders only; live DB not connected |
| **External / Live** | Store Submission / EAS Remote Build | ❌ NOT RUN | No remote cloud EAS build or submission attempted |
| **External / Live** | Native Branding Presentation | ❌ UNVERIFIED | Static image contracts verified separately; native presentation unverified |
| **External / Live** | Backend Deletion Feature | ⚠️ Needs Attention | Rollback/exactly-once regressions and live PostgreSQL proof unresolved |
| **External / Live** | Auth Review Scope | ⚠️ Needs Attention | Settled in needs-attention status after final correction (worker not running) |
| **External / Live** | Clean Root Install | ❌ NOT RUN | Clean `npm ci` unverified by parent to avoid disturbing `node_modules` |
