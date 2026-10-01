# Haseela Mobile (Expo / React Native)

Haseela Mobile is the mobile client for the Haseela Freelancer Budget & Invoice Tracker, built with Expo SDK 57, React Native 0.86, and React 19.

## Monorepo Architecture

This package is part of an npm monorepo (`apps/*`, `packages/*`).

- **Root Dependencies**: Always run `npm ci` from the **repository root**. Do not run isolated installations inside `apps/mobile`. Clean install from root remains unverified by parent.
- **Workspace Commands**: Execute workspace tasks from the root:
  - `npm run start -w apps/mobile` – Start Expo development server
  - `npm run android -w apps/mobile` – Launch on Android emulator/device
  - `npm run ios -w apps/mobile` – Launch on iOS simulator
  - `npm run lint -w apps/mobile` – Run ESLint across mobile codebase
  - `npm run typecheck -w apps/mobile` – Run TypeScript type checking
  - `npm test -w apps/mobile -- --runInBand` – Run Jest test suite
  - `npm exec -w apps/mobile -- expo export --platform android --output-dir .export-ci-check` – Verify local Android bundle export

## EAS Build Preparation

EAS configuration is set up for local version tracking (`apps/mobile/eas.json`):

```bash
cd apps/mobile
# Generate internal preview APK for Android device testing:
eas build --profile preview --platform android

# Generate production store AAB / iOS archive:
eas build --profile production --platform android
eas build --profile production --platform ios
```

> **Important**: Per Expo Monorepo guidelines, EAS CLI commands should be executed from the `apps/mobile` directory.

### Build Profiles

| Profile | Platform | Artifact / Distribution | Channel | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `preview` | Android | APK (`buildType: "apk"`) / `internal` | `preview` | Shareable testing build for manual installation |
| `production` | Android | AAB (`buildType: "app-bundle"`) / `store` | `production` | Google Play Store bundle |
| `production` | iOS | Archive / `store` | `production` | Apple App Store / TestFlight |

### Version Management

- Versioning is configured as **local** (`cli.appVersionSource: "local"` in `eas.json`).
- `apps/mobile/app.json` contains:
  - `version`: Marketing semver string (`1.0.0`)
  - `android.versionCode`: Integer (`1`)
  - `ios.buildNumber`: String (`"1"`)
- Any version bumping must be explicitly committed to version control.
- Runtime version reporting should consume `expo-application` to obtain binary release versions.

## Environment Variables & Security

Only public client variables prefixed with `EXPO_PUBLIC_` are bundled into the client:

- `EXPO_PUBLIC_SUPABASE_URL`: Required HTTPS Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: Required public anonymous/publishable key (`sb_publishable_*` or legacy 3-part base64url JWT with `role: "anon"`).
- `EXPO_PUBLIC_API_URL`: Required HTTPS API endpoint for backend service communication.
- `EXPO_PUBLIC_EAS_PROJECT_ID`: Required valid UUID syntax for production cloud EAS builds (unlinked if absent; remote project linkage unverified locally).

### Critical Security Rules
- **NEVER** expose backend secrets in mobile configuration (`sb_secret_*`, `SUPABASE_SERVICE_ROLE_KEY`, database credentials).
- The release preflight script strictly rejects any service role or secret keys without printing raw values.

## Release Readiness Boundaries & Unverified Status

- **Branding Assets**: Generated Haseela assets are not stock; static image contracts are verified separately, but native presentation on physical devices remains unverified.
- **Push Notifications & Credentials**: Remote push notification testing (APNs / FCM) requires a native build with signing credentials (`credentials.json`, `google-services.json`). Credentials cannot be inferred absent from the repository alone and remain unverified. Push notifications cannot be tested in Expo Go.
- **Over-The-Air (OTA) Updates**: `expo-updates` is not currently installed as a direct dependency. No over-the-air updates or pretend URLs are configured.
- **Google Play 14-Day Tester Requirement**: For new personal developer accounts, Google Play requires at least 12 testers opted in continuously for at least 14 days before production access (see [Google Play Console testing guidelines](https://support.google.com/googleplay/android-developer/answer/14151465)).
- **Backend Deletion Endpoint**: The deletion endpoint has unit tests, but two required rollback/exactly-once regressions and live PostgreSQL proof remain unresolved; backend deletion is settled in needs-attention status.
- **Auth Review Scope**: Mobile auth flows are settled in needs-attention status following final correction (correction limits exhausted; worker not running).

## Preflight Verification Scripts

Run the release preflight checks from the repo root:

```bash
# Static structural check (for local development and CI):
node scripts/check-mobile-release.cjs --static

# Strict production check (requires valid HTTPS URLs, public anon key, and EAS project UUID syntax):
node scripts/check-mobile-release.cjs --production
```
