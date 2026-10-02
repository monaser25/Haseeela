#!/usr/bin/env node
/**
 * scripts/check-mobile-release.cjs
 * Validates local CI/EAS configuration for agreed Haseela mobile V1.
 *
 * Supported modes:
 *   --static     Structural/local CI pass (NOT proof of production readiness).
 *   --production Strict preflight requiring real non-placeholder prerequisites.
 *
 * SAFETY & LIMITATIONS:
 *   - Public clients reject known sb_secret_* and service_role JWT keys.
 *   - NEVER prints raw env/keys/tokens/secrets/claims/URLs in diagnostic output.
 *   - No network calls, no .env.local reads.
 *   - Local validation is purely structural: does NOT verify remote key signatures,
 *     Supabase project linkage, or network connectivity.
 */

const fs = require('node:fs');
const path = require('node:path');

const KNOWN_LIMITATIONS = [
  'Firebase/APNs Signing: Push credentials and native notification entitlements are unverified in local environment (cannot be inferred absent from repository alone).',
  'Live Backend/Auth/SMTP/RLS: Live Supabase database, row-level security, auth triggers, and SMTP delivery are unverified locally.',
  'Physical Device Verification: Real hardware checks on physical Android and iOS devices have not been performed (Hermes bundle export and Jest only).',
  'Haseela Branding Assets: Generated Haseela assets are not stock; static image contracts are verified separately, but native presentation on physical devices remains unverified.',
  'Backend Deletion Endpoint: Deletion endpoint has tests, but two required rollback/exactly-once regressions and live PostgreSQL proof remain unresolved; backend deletion is settled in needs-attention status.',
  'Auth Scope Settled: Mobile auth flows are settled in needs-attention status following final correction (correction limits exhausted; worker not running).',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;
const SB_PUBLISHABLE_REGEX = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;

function isSupportedNodeVersion(versionString) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(versionString || '');
  if (!match) return false;
  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3], 10);

  // ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25
  if (major === 20) {
    return minor > 19 || (minor === 19 && patch >= 4);
  }
  if (major === 22) {
    return minor > 13 || (minor === 13 && patch >= 0);
  }
  if (major === 24) {
    return minor > 3 || (minor === 3 && patch >= 0);
  }
  if (major >= 25) {
    return true;
  }
  return false;
}

function isValidBase64UrlSegment(segment) {
  if (typeof segment !== 'string' || !segment) return false;
  // An unpadded base64/base64url string cannot have length % 4 === 1
  if (segment.length % 4 === 1) return false;
  return BASE64URL_REGEX.test(segment);
}

function parseJwtSegment(segment) {
  if (!isValidBase64UrlSegment(segment)) {
    return null;
  }
  try {
    let base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Permissive base64 / base64url segment decoding for secret detection
function permissiveDecodeSegment(segment) {
  if (typeof segment !== 'string' || !segment.trim()) return null;
  const clean = segment.trim();
  try {
    let base64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    try {
      const parsed = JSON.parse(decoded);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch {
      // Not JSON, return string wrapper
    }
    return { _raw: decoded };
  } catch {
    return null;
  }
}

// Permissive secret key detection (detects service_role across custom headers and padded base64 payloads)
function isSecretKey(key) {
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  const lower = trimmed.toLowerCase();

  if (trimmed.startsWith('sb_secret_')) return true;
  if (lower.includes('service_role') || lower.includes('service-role')) return true;

  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    for (const part of parts) {
      const decoded = permissiveDecodeSegment(part);
      if (decoded) {
        if (decoded.role === 'service_role' || String(decoded.role || '').toLowerCase().includes('service_role')) {
          return true;
        }
        if (decoded._raw && decoded._raw.toLowerCase().includes('service_role')) {
          return true;
        }
        if (typeof decoded === 'object' && JSON.stringify(decoded).toLowerCase().includes('service_role')) {
          return true;
        }
      }
    }
  }

  return false;
}

function validatePublicAnonKey(key, allowPlaceholders = false) {
  if (!key || typeof key !== 'string' || !key.trim()) {
    return { valid: false, reason: 'Key is missing or empty' };
  }
  const trimmed = key.trim();

  if (isSecretKey(trimmed)) {
    return { valid: false, reason: 'Contains forbidden secret or service_role key' };
  }

  if (allowPlaceholders && (trimmed === 'ci-anon-placeholder' || trimmed.includes('placeholder'))) {
    return { valid: true, type: 'placeholder' };
  }

  // Modern Supabase publishable key format: URL-safe ASCII character set
  if (trimmed.startsWith('sb_publishable_')) {
    if (SB_PUBLISHABLE_REGEX.test(trimmed)) {
      return { valid: true, type: 'publishable' };
    }
    return { valid: false, reason: 'Publishable key contains invalid characters or malformed format' };
  }

  // Legacy Supabase JWT format: strictly requires 3 non-empty base64url parts with valid JSON header and payload
  const parts = trimmed.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return {
      valid: false,
      reason: 'Invalid public key structure: legacy public token requires three nonempty base64url segments',
    };
  }

  // Validate all three segments have valid base64url encoding and non-impossible lengths
  if (!isValidBase64UrlSegment(parts[0]) || !isValidBase64UrlSegment(parts[1]) || !isValidBase64UrlSegment(parts[2])) {
    return {
      valid: false,
      reason: 'Invalid public key structure: JWT segments must be valid base64url encoding',
    };
  }

  const header = parseJwtSegment(parts[0]);
  if (!header) {
    return { valid: false, reason: 'Invalid public key structure: token header is not a valid JSON object' };
  }

  const payload = parseJwtSegment(parts[1]);
  if (!payload) {
    return { valid: false, reason: 'Invalid public key structure: token payload is not a valid JSON object' };
  }

  // Check own-property presence of subject claim, not truthiness
  if (Object.prototype.hasOwnProperty.call(payload, 'sub')) {
    return { valid: false, reason: 'Contains user subject claim instead of public anonymous key' };
  }

  if (payload.role !== 'anon') {
    return { valid: false, reason: 'JWT role is not anon' };
  }

  return { valid: true, type: 'legacy_anon_jwt' };
}

function isLoopbackOrLocalHost(rawHost) {
  if (!rawHost) return false;
  const lower = rawHost.toLowerCase();
  let clean = lower.startsWith('[') && lower.endsWith(']') ? lower.slice(1, -1) : lower;
  clean = clean.replace(/\.+$/, '');

  if (clean === 'localhost' || clean.endsWith('.localhost')) {
    return true;
  }

  if (clean === 'local' || clean.endsWith('.local')) {
    return true;
  }

  if (clean === '::1' || clean === '0:0:0:0:0:0:0:1' || clean === '::' || clean === '0.0.0.0') {
    return true;
  }

  // IPv4 127.0.0.0/8 range
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(clean);
  if (ipv4Match) {
    const o1 = Number(ipv4Match[1]);
    const o2 = Number(ipv4Match[2]);
    const o3 = Number(ipv4Match[3]);
    const o4 = Number(ipv4Match[4]);
    if (o1 === 127 && o2 <= 255 && o3 <= 255 && o4 <= 255) {
      return true;
    }
    if (o1 === 0 && o2 === 0 && o3 === 0 && o4 === 0) {
      return true;
    }
  }

  // IPv4-mapped IPv6 loopbacks (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (clean.startsWith('::ffff:')) {
    const mapped = clean.slice(7);
    if (isLoopbackOrLocalHost(mapped)) {
      return true;
    }
    if (/^7f[0-9a-f]{2}:/i.test(mapped)) {
      return true;
    }
  }

  return false;
}

function validateAbsoluteHttpsUrl(urlString, fieldName, allowPlaceholders = false) {
  if (!urlString || typeof urlString !== 'string' || !urlString.trim()) {
    return `Missing required URL for ${fieldName}`;
  }
  const trimmed = urlString.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return `${fieldName} is not a syntactically valid URL: malformed structure`;
  }

  if (parsed.protocol !== 'https:') {
    return `${fieldName} must use HTTPS protocol`;
  }

  if (!parsed.hostname || parsed.hostname.length === 0) {
    return `${fieldName} must have a non-empty hostname`;
  }

  if (parsed.username || parsed.password) {
    return `${fieldName} contains forbidden embedded user credentials`;
  }

  const rawHost = parsed.hostname.toLowerCase();

  if (!allowPlaceholders) {
    if (isLoopbackOrLocalHost(rawHost)) {
      return `${fieldName} cannot use loopback or local hostname in production mode`;
    }

    const cleanHost = rawHost.replace(/\.+$/, '');
    const isPlaceholder =
      cleanHost.includes('example.supabase.co') ||
      cleanHost === 'example.com' ||
      cleanHost.includes('placeholder');

    if (isPlaceholder) {
      return `${fieldName} cannot use placeholder domain in production mode`;
    }
  }

  return null;
}

function validateConfig(options = {}) {
  const mode = options.mode || 'static';
  const env = options.env || process.env;
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const checkNodeEngine = options.checkNodeEngine !== false;
  const checkGitignore = options.checkGitignore !== false;

  const errors = [];
  const warnings = [];
  const info = [];

  // 1. Node engine check
  if (checkNodeEngine) {
    const currentNode = process.version;
    if (!isSupportedNodeVersion(currentNode)) {
      errors.push(`Node engine unsupported: ${currentNode}. Expected ^20.19.4 || ^22.13.0 || ^24.3.0 || >=25.`);
    } else {
      info.push(`Node version supported: ${currentNode}`);
    }
  }

  // 2. Mobile package.json
  const mobilePkgPath = path.join(projectRoot, 'apps', 'mobile', 'package.json');
  let mobilePkg = null;
  if (!fs.existsSync(mobilePkgPath)) {
    errors.push('apps/mobile/package.json not found');
  } else {
    try {
      mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'));
      if (mobilePkg.name !== '@haseela/mobile') {
        errors.push(`apps/mobile/package.json name should be "@haseela/mobile", got "${mobilePkg.name}"`);
      }
      if (!mobilePkg.scripts || !mobilePkg.scripts.lint) {
        errors.push('apps/mobile/package.json is missing "lint" script');
      }
    } catch (e) {
      errors.push(`Failed to parse apps/mobile/package.json: ${e.message}`);
    }
  }

  const hasDevClient = Boolean(
    mobilePkg && (
      (mobilePkg.dependencies && mobilePkg.dependencies['expo-dev-client']) ||
      (mobilePkg.devDependencies && mobilePkg.devDependencies['expo-dev-client'])
    )
  );

  const hasExpoUpdates = Boolean(
    mobilePkg && (
      (mobilePkg.dependencies && mobilePkg.dependencies['expo-updates']) ||
      (mobilePkg.devDependencies && mobilePkg.devDependencies['expo-updates'])
    )
  );

  // 3. apps/mobile/app.json
  const appJsonPath = path.join(projectRoot, 'apps', 'mobile', 'app.json');
  let appJson = null;
  if (!fs.existsSync(appJsonPath)) {
    errors.push('apps/mobile/app.json not found');
  } else {
    try {
      appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
      const expo = appJson.expo || {};

      if (expo.name !== 'Haseela') errors.push(`app.json name must be "Haseela", got "${expo.name}"`);
      if (expo.slug !== 'haseela') errors.push(`app.json slug must be "haseela", got "${expo.slug}"`);
      if (expo.scheme !== 'haseela') errors.push(`app.json scheme must be "haseela", got "${expo.scheme}"`);

      // Version must be valid semver format, accepting future release bumps
      if (!expo.version || !SEMVER_REGEX.test(expo.version)) {
        errors.push(`app.json version must be a valid semver string (e.g. "1.0.0"), got "${expo.version}"`);
      }

      // Android
      const android = expo.android || {};
      if (android.package !== 'com.haseela.app') {
        errors.push(`app.json android.package must be "com.haseela.app", got "${android.package}"`);
      }
      if (!Number.isInteger(android.versionCode) || android.versionCode < 1) {
        errors.push(`app.json android.versionCode must be a positive integer, got ${android.versionCode}`);
      }
      if (android.supportsRTL !== true) {
        errors.push('app.json android.supportsRTL must be true');
      }

      // iOS
      const ios = expo.ios || {};
      if (ios.bundleIdentifier !== 'com.haseela.app') {
        errors.push(`app.json ios.bundleIdentifier must be "com.haseela.app", got "${ios.bundleIdentifier}"`);
      }
      const iosBuildNumStr = String(ios.buildNumber || '').trim();
      if (!/^\d+$/.test(iosBuildNumStr) || parseInt(iosBuildNumStr, 10) < 1) {
        errors.push(`app.json ios.buildNumber must be a positive integer, got "${ios.buildNumber}"`);
      }
      if (ios.supportsRTL !== true) {
        errors.push('app.json ios.supportsRTL must be true');
      }

      // Localization
      if (expo.supportsRTL !== true) {
        errors.push('app.json root supportsRTL must be true');
      }

      // OTA claim check
      if (!hasExpoUpdates && expo.updates && expo.updates.url) {
        errors.push('app.json defines updates.url but expo-updates is not installed as a direct dependency');
      }
    } catch (e) {
      errors.push(`Failed to parse apps/mobile/app.json: ${e.message}`);
    }
  }

  // 4. apps/mobile/eas.json
  const easJsonPath = path.join(projectRoot, 'apps', 'mobile', 'eas.json');
  if (!fs.existsSync(easJsonPath)) {
    errors.push('apps/mobile/eas.json not found');
  } else {
    try {
      const easJson = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));

      if (!easJson.cli || easJson.cli.appVersionSource !== 'local') {
        errors.push('eas.json cli.appVersionSource must be "local"');
      }

      const build = easJson.build || {};
      if (!build.preview) {
        errors.push('eas.json missing "preview" build profile');
      } else {
        if (build.preview.distribution !== 'internal') {
          errors.push('eas.json preview profile distribution must be "internal"');
        }
        if (!build.preview.android || build.preview.android.buildType !== 'apk') {
          errors.push('eas.json preview profile android.buildType must be "apk"');
        }
      }

      if (!build.production) {
        errors.push('eas.json missing "production" build profile');
      } else {
        if (build.production.distribution !== 'store') {
          errors.push('eas.json production profile distribution must be "store"');
        }
        if (!build.production.android || build.production.android.buildType !== 'app-bundle') {
          errors.push('eas.json production profile android.buildType must be "app-bundle"');
        }
        if (!build.production.ios) {
          errors.push('eas.json production profile missing ios profile');
        }
      }

      // Ensure no developmentClient: true without expo-dev-client
      for (const [profileName, profile] of Object.entries(build)) {
        if (profile && profile.developmentClient === true && !hasDevClient) {
          errors.push(`eas.json profile "${profileName}" enables developmentClient without expo-dev-client installed`);
        }
      }
    } catch (e) {
      errors.push(`Failed to parse apps/mobile/eas.json: ${e.message}`);
    }
  }

  // 5. .gitignore checks
  if (checkGitignore) {
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = fs.readFileSync(gitignorePath, 'utf8');

      const requiredPatterns = ['.expo', '.export', '*.apk', '*.aab'];
      for (const req of requiredPatterns) {
        if (!gitignore.includes(req)) {
          errors.push(`.gitignore missing required mobile output ignore pattern: "${req}"`);
        }
      }

      // Blanket ignore check
      const lines = gitignore.split(/\r?\n/).map((l) => l.trim());
      if (lines.includes('apps/mobile') || lines.includes('apps/mobile/')) {
        errors.push('.gitignore contains forbidden blanket ignore for apps/mobile');
      }
      if (lines.includes('packages/shared') || lines.includes('packages/shared/')) {
        errors.push('.gitignore contains forbidden blanket ignore for packages/shared');
      }
    }
  }

  // 6. Environment & Secret Key Checks
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  const apiUrl = env.EXPO_PUBLIC_API_URL;
  const easProjectId = env.EXPO_PUBLIC_EAS_PROJECT_ID;

  // Check all EXPO_PUBLIC_* variables for secret keys (never output key values)
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('EXPO_PUBLIC_') && value) {
      if (isSecretKey(value)) {
        errors.push(`Public environment variable "${key}" contains forbidden secret or service_role key.`);
      }
    }
  }

  if (mode === 'static') {
    if (!supabaseUrl) {
      warnings.push('EXPO_PUBLIC_SUPABASE_URL is not set (CI static preflight allows placeholders).');
    } else {
      info.push('EXPO_PUBLIC_SUPABASE_URL is defined.');
    }
    if (!anonKey) {
      warnings.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is not set (CI static preflight allows placeholders).');
    } else {
      info.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is defined.');
    }
    if (!apiUrl) {
      warnings.push('EXPO_PUBLIC_API_URL is not set (CI static preflight allows placeholders).');
    } else {
      info.push('EXPO_PUBLIC_API_URL is defined.');
    }
  } else if (mode === 'production') {
    // Production preflight requires syntactically valid HTTPS URLs without loopback or placeholders
    const supabaseUrlErr = validateAbsoluteHttpsUrl(supabaseUrl, 'EXPO_PUBLIC_SUPABASE_URL', false);
    if (supabaseUrlErr) {
      errors.push(`Production preflight: ${supabaseUrlErr}`);
    }

    const apiUrlErr = validateAbsoluteHttpsUrl(apiUrl, 'EXPO_PUBLIC_API_URL', false);
    if (apiUrlErr) {
      errors.push(`Production preflight: ${apiUrlErr}`);
    }

    const anonKeyResult = validatePublicAnonKey(anonKey, false);
    if (!anonKeyResult.valid) {
      errors.push(`Production preflight: EXPO_PUBLIC_SUPABASE_ANON_KEY is invalid (${anonKeyResult.reason}).`);
    }

    if (!easProjectId) {
      errors.push('Production preflight: EXPO_PUBLIC_EAS_PROJECT_ID is required for production build.');
    } else if (!UUID_REGEX.test(easProjectId.trim())) {
      errors.push('Production preflight: EXPO_PUBLIC_EAS_PROJECT_ID must be a valid UUID.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    info,
    limitations: KNOWN_LIMITATIONS,
  };
}

function runCli(args = process.argv.slice(2), env = process.env) {
  const mode = args.includes('--production') ? 'production' : 'static';

  console.log('======================================================');
  console.log(` Haseela Mobile Release Config Check [Mode: ${mode.toUpperCase()}]`);
  console.log(' Note: Structural preflight only. Does not verify remote');
  console.log(' credentials, project linkage, or network connectivity.');
  console.log('======================================================\n');

  const result = validateConfig({ mode, env });

  console.log('1. Configuration & Engine Checks:');
  for (const item of result.info) {
    console.log(`   [OK] ${item}`);
  }

  if (result.warnings.length > 0) {
    console.log('\n2. Warnings:');
    for (const w of result.warnings) {
      console.log(`   [WARN] ${w}`);
    }
  }

  console.log('\n3. Known Production Limitations (Explicitly Declared):');
  for (const lim of result.limitations) {
    console.log(`   - ${lim}`);
  }

  if (!result.valid) {
    console.log('\n❌ Configuration Validation FAILED:');
    for (const err of result.errors) {
      console.log(`   - ${err}`);
    }
    console.log('\nResult: FAIL (Exit code 1)\n');
    return 1;
  }

  console.log('\n------------------------------------------------------');
  if (mode === 'static') {
    console.log('✅ STATIC STRUCTURAL CHECK PASSED');
    console.log('NOTE: Static local pass is NOT proof of production readiness or store approval.');
  } else {
    console.log('✅ PRODUCTION PREFLIGHT PASSED');
    console.log('NOTE: Structural config is valid. Live native, credentials, and backend proofs remain.');
  }
  console.log('------------------------------------------------------\n');
  return 0;
}

if (require.main === module) {
  const exitCode = runCli();
  process.exit(exitCode);
}

module.exports = {
  validateConfig,
  isSecretKey,
  validatePublicAnonKey,
  validateAbsoluteHttpsUrl,
  isSupportedNodeVersion,
  runCli,
  KNOWN_LIMITATIONS,
};
