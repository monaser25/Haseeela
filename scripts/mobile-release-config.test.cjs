const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const {
  validateConfig,
  isSecretKey,
  validatePublicAnonKey,
  validateAbsoluteHttpsUrl,
  isSupportedNodeVersion,
  runCli,
  KNOWN_LIMITATIONS,
} = require('./check-mobile-release.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

// Helper to create synthetic structural JWT fixtures without real credentials
function makeSyntheticJwt(payload, header = { alg: 'HS256', typ: 'JWT' }) {
  const headerPart = Buffer.from(JSON.stringify(header)).toString('base64url');
  const bodyPart = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sigPart = Buffer.from('structural-fixture-signature-bytes').toString('base64url');
  return `${headerPart}.${bodyPart}.${sigPart}`;
}

describe('Mobile Release Config Validator', () => {
  describe('Node engine support', () => {
    it('accepts supported Node versions (^20.19.4 || ^22.13.0 || ^24.3.0 || >=25)', () => {
      assert.strictEqual(isSupportedNodeVersion('v20.19.4'), true);
      assert.strictEqual(isSupportedNodeVersion('v20.20.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v22.13.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v22.14.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v24.3.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v24.13.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v25.0.0'), true);
      assert.strictEqual(isSupportedNodeVersion('v26.1.0'), true);
    });

    it('rejects unsupported Node versions', () => {
      assert.strictEqual(isSupportedNodeVersion('v20.18.0'), false);
      assert.strictEqual(isSupportedNodeVersion('v22.12.0'), false);
      assert.strictEqual(isSupportedNodeVersion('v24.2.0'), false);
      assert.strictEqual(isSupportedNodeVersion('v18.20.0'), false);
      assert.strictEqual(isSupportedNodeVersion('v16.14.0'), false);
    });
  });

  describe('Secret Key Rejection & Public Key Validation', () => {
    it('detects sb_secret_* prefix as secret', () => {
      assert.strictEqual(isSecretKey('sb_secret_abcdef1234567890'), true);
      assert.strictEqual(isSecretKey('sb_secret_xyz'), true);
    });

    it('detects service_role strings and tokens regardless of token prefix or base64 padding', () => {
      assert.strictEqual(isSecretKey('ci-service-role-placeholder'), true);
      assert.strictEqual(isSecretKey('some_service_role_key'), true);
      const serviceRoleJwt = makeSyntheticJwt({ role: 'service_role' });
      assert.strictEqual(isSecretKey(serviceRoleJwt), true);

      // Dot-separated token without eyJ prefix
      const nonEyJwt = `custom_hdr.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.sig`;
      assert.strictEqual(isSecretKey(nonEyJwt), true);

      // Regression: token with custom header, standard base64 padded payload with '='
      const paddedSecret =
        'custom_hdr.' +
        Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64') +
        '.' +
        Buffer.from('fixture-signature-bytes').toString('base64url');
      assert.strictEqual(isSecretKey(paddedSecret), true, 'Padded service_role token must be detected');

      // Verify static mode rejects when placed in EXPO_PUBLIC_EXTRA_TOKEN
      const staticConf = validateConfig({
        mode: 'static',
        env: { EXPO_PUBLIC_EXTRA_TOKEN: paddedSecret },
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });
      assert.strictEqual(staticConf.valid, false, 'Config must reject padded service_role key');
    });

    it('recognizes valid public anon key kinds: sb_publishable_* and legacy anon JWT', () => {
      const pubKey = 'sb_publishable_structural_fixture_test_key_12345';
      const pubRes = validatePublicAnonKey(pubKey, false);
      assert.strictEqual(pubRes.valid, true);
      assert.strictEqual(pubRes.type, 'publishable');

      const anonJwt = makeSyntheticJwt({ role: 'anon', exp: 1999999999 });
      const anonRes = validatePublicAnonKey(anonJwt, false);
      assert.strictEqual(anonRes.valid, true);
      assert.strictEqual(anonRes.type, 'legacy_anon_jwt');
    });

    it('rejects two-part tokens or malformed JWT headers without signature', () => {
      const twoPart = 'not-json-header.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');
      const twoPartRes = validatePublicAnonKey(twoPart, false);
      assert.strictEqual(twoPartRes.valid, false, 'Two part token must be rejected');

      const badHeader = 'not-json-header.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.sig';
      const badHeaderRes = validatePublicAnonKey(badHeader, false);
      assert.strictEqual(badHeaderRes.valid, false, 'Non-JSON header JWT must be rejected');
    });

    it('rejects tokens with malformed third segment (signature) or impossible encoded lengths', () => {
      const headerPart = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const bodyPart = Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url');

      // Malformed signature characters
      assert.strictEqual(validatePublicAnonKey(`${headerPart}.${bodyPart}.!`, false).valid, false);
      assert.strictEqual(validatePublicAnonKey(`${headerPart}.${bodyPart}.bad signature`, false).valid, false);
      assert.strictEqual(validatePublicAnonKey(`${headerPart}.${bodyPart}.🎉`, false).valid, false);

      // Impossible base64url encoded length (len % 4 === 1)
      assert.strictEqual(validatePublicAnonKey(`${headerPart}.${bodyPart}.a`, false).valid, false);
      assert.strictEqual(validatePublicAnonKey(`a.${bodyPart}.${Buffer.from('sig').toString('base64url')}`, false).valid, false);
    });

    it('rejects tokens containing subject claim (user identity) even if empty, null, numeric, or role is anon', () => {
      const subVariants = ['', null, 0, 123, 'synthetic-user-uuid'];
      for (const subVal of subVariants) {
        const token = makeSyntheticJwt({ role: 'anon', sub: subVal });
        const res = validatePublicAnonKey(token, false);
        assert.strictEqual(res.valid, false, `Tokens with sub claim (${JSON.stringify(subVal)}) must be rejected`);
      }
    });

    it('rejects non-ASCII or malformed characters in sb_publishable_* suffix', () => {
      const emojiKey = 'sb_publishable_' + String.fromCodePoint(0x1f4a5).repeat(10);
      const emojiRes = validatePublicAnonKey(emojiKey, false);
      assert.strictEqual(emojiRes.valid, false, 'Emoji suffix in sb_publishable must be rejected');

      const spacesKey = 'sb_publishable_valid looking but has spaces';
      const spacesRes = validatePublicAnonKey(spacesKey, false);
      assert.strictEqual(spacesRes.valid, false, 'Spaces in sb_publishable must be rejected');
    });

    it('does not leak decoded raw claims in diagnostics (redacted output)', () => {
      const sentinel = 'PRIVATE_DIAGNOSTIC_SENTINEL_9381';
      const sentinelJwt = makeSyntheticJwt({ role: sentinel });
      const sentinelRes = validatePublicAnonKey(sentinelJwt, false);
      assert.strictEqual(sentinelRes.valid, false);
      assert.strictEqual(sentinelRes.reason.includes(sentinel), false, 'Diagnostic reason must not leak raw claim');

      // Check validateConfig does not leak sentinel
      const configRes = validateConfig({
        mode: 'production',
        env: {
          EXPO_PUBLIC_SUPABASE_URL: 'https://structural-project.supabase.co',
          EXPO_PUBLIC_SUPABASE_ANON_KEY: sentinelJwt,
          EXPO_PUBLIC_API_URL: 'https://api.structural-domain.com',
          EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
        },
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });
      assert.strictEqual(configRes.valid, false);
      const allErrors = configRes.errors.join(' ');
      assert.strictEqual(allErrors.includes(sentinel), false, 'Errors must not leak raw claim');
    });

    it('rejects arbitrary garbage, authenticated JWTs, and secret keys as anon key', () => {
      const garbageRes = validatePublicAnonKey('not-a-public-key', false);
      assert.strictEqual(garbageRes.valid, false);

      const authJwt = makeSyntheticJwt({ role: 'authenticated', sub: 'user-uuid-123' });
      const authRes = validatePublicAnonKey(authJwt, false);
      assert.strictEqual(authRes.valid, false);

      const secretRes = validatePublicAnonKey('sb_secret_something', false);
      assert.strictEqual(secretRes.valid, false);
    });

    it('allows placeholders in static mode but rejects in production mode', () => {
      const staticRes = validatePublicAnonKey('ci-anon-placeholder', true);
      assert.strictEqual(staticRes.valid, true);

      const prodRes = validatePublicAnonKey('ci-anon-placeholder', false);
      assert.strictEqual(prodRes.valid, false);
    });
  });

  describe('Absolute HTTPS URL Validation', () => {
    it('validates correct HTTPS URLs', () => {
      assert.strictEqual(validateAbsoluteHttpsUrl('https://api.structural-domain.com/v1', 'API_URL', false), null);
      assert.strictEqual(validateAbsoluteHttpsUrl('https://structural-project.supabase.co', 'SUPABASE_URL', false), null);
    });

    it('rejects malformed URLs, non-HTTPS protocols, empty hostnames, and loopbacks', () => {
      assert.ok(validateAbsoluteHttpsUrl('https://', 'API_URL', false));
      assert.ok(validateAbsoluteHttpsUrl('not-a-url', 'API_URL', false));
      assert.ok(validateAbsoluteHttpsUrl('http://insecure.domain.com', 'API_URL', false));
      assert.ok(validateAbsoluteHttpsUrl('https://localhost:3000', 'API_URL', false));
      assert.ok(validateAbsoluteHttpsUrl('https://127.0.0.1:8000', 'API_URL', false));
      // IPv6 loopback normalized
      assert.ok(validateAbsoluteHttpsUrl('https://[::1]:3000', 'API_URL', false), 'IPv6 loopback must be rejected');

      // Loopback variants: 127/8, .localhost, trailing dot, IPv4-mapped IPv6
      const loopbacks = [
        'https://127.0.0.2:3000',
        'https://127.255.255.254:8080',
        'https://foo.localhost:3000',
        'https://localhost.:3000',
        'https://sub.local:3000',
        'https://[::ffff:127.0.0.1]:8080',
      ];
      for (const lb of loopbacks) {
        assert.ok(validateAbsoluteHttpsUrl(lb, 'API_URL', false), `Loopback variant ${lb} must be rejected`);
      }
    });

    it('rejects URLs with embedded username or password and does not echo credentials', () => {
      const user = 'fixture-user';
      const pass = 'fixture-password';
      const credUrl = `https://${user}:${pass}@api.structural-domain.com`;
      const err = validateAbsoluteHttpsUrl(credUrl, 'API_URL', false);
      assert.ok(err, 'Embedded credentials must be rejected');
      assert.strictEqual(err.includes(user), false, 'Error message must not echo username');
      assert.strictEqual(err.includes(pass), false, 'Error message must not echo password');
    });

    it('rejects placeholder URLs in production mode but allows in static mode', () => {
      assert.ok(validateAbsoluteHttpsUrl('https://example.supabase.co', 'SUPABASE_URL', false));
      assert.ok(validateAbsoluteHttpsUrl('https://example.com', 'API_URL', false));
      assert.strictEqual(validateAbsoluteHttpsUrl('https://example.supabase.co', 'SUPABASE_URL', true), null);
    });
  });

  describe('Static Mode (--static)', () => {
    it('passes for real workspace config in repo root with CI placeholders', () => {
      const syntheticCiEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'ci-anon-placeholder',
        EXPO_PUBLIC_API_URL: 'https://example.com',
      };

      const result = validateConfig({
        mode: 'static',
        env: syntheticCiEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, true, `Expected valid static config, got errors: ${result.errors.join('; ')}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it('rejects if a secret key is placed in EXPO_PUBLIC_SUPABASE_ANON_KEY', () => {
      const dirtyEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_forbidden_key_123',
      };

      const result = validateConfig({
        mode: 'static',
        env: dirtyEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('secret') || e.includes('service_role')));
      // Never leak key values
      assert.ok(!JSON.stringify(result).includes('forbidden_key_123'));
    });
  });

  describe('Production Mode (--production) Negative & Positive Probes', () => {
    it('reproduces parent negative probe: fails on missing API_URL, malformed URL, garbage key', () => {
      const badEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'not-a-public-key',
        EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
        // NO EXPO_PUBLIC_API_URL
      };

      const result = validateConfig({
        mode: 'production',
        env: badEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('EXPO_PUBLIC_API_URL')));
      assert.ok(result.errors.some((e) => e.includes('EXPO_PUBLIC_SUPABASE_URL')));
      assert.ok(result.errors.some((e) => e.includes('EXPO_PUBLIC_SUPABASE_ANON_KEY')));
    });

    it('passes in production mode when structurally valid non-placeholder inputs are provided', () => {
      const structuralProdEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://structural-project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: makeSyntheticJwt({ role: 'anon', exp: 2000000000 }),
        EXPO_PUBLIC_API_URL: 'https://api.structural-domain.com',
        EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = validateConfig({
        mode: 'production',
        env: structuralProdEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, true, `Expected valid prod config, got: ${result.errors.join('; ')}`);
      assert.strictEqual(result.errors.length, 0);
    });

    it('accepts sb_publishable_* format key in production mode', () => {
      const publishableEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://structural-project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture_token_structural_valid_123',
        EXPO_PUBLIC_API_URL: 'https://api.structural-domain.com',
        EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = validateConfig({
        mode: 'production',
        env: publishableEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, true);
    });

    it('data-driven production mode failures for specific single-field mutations', () => {
      const baseValidProd = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://structural-project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: makeSyntheticJwt({ role: 'anon', exp: 2000000000 }),
        EXPO_PUBLIC_API_URL: 'https://api.structural-domain.com',
        EXPO_PUBLIC_EAS_PROJECT_ID: '123e4567-e89b-12d3-a456-426614174000',
      };

      const testCases = [
        {
          name: 'loopback IP in API_URL',
          patch: { EXPO_PUBLIC_API_URL: 'https://127.0.0.2:3000' },
          expectedError: 'EXPO_PUBLIC_API_URL',
        },
        {
          name: '.localhost subdomain in API_URL',
          patch: { EXPO_PUBLIC_API_URL: 'https://foo.localhost:3000' },
          expectedError: 'EXPO_PUBLIC_API_URL',
        },
        {
          name: 'embedded credentials in SUPABASE_URL',
          patch: { EXPO_PUBLIC_SUPABASE_URL: 'https://user:pass@structural-project.supabase.co' },
          expectedError: 'EXPO_PUBLIC_SUPABASE_URL',
        },
        {
          name: 'anon key with empty sub claim',
          patch: { EXPO_PUBLIC_SUPABASE_ANON_KEY: makeSyntheticJwt({ role: 'anon', sub: '' }) },
          expectedError: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
        },
        {
          name: 'anon key with malformed signature text',
          patch: {
            EXPO_PUBLIC_SUPABASE_ANON_KEY:
              Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
              '.' +
              Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') +
              '.!',
          },
          expectedError: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
        },
      ];

      for (const tc of testCases) {
        const env = { ...baseValidProd, ...tc.patch };
        const res = validateConfig({
          mode: 'production',
          env,
          projectRoot: REPO_ROOT,
          checkNodeEngine: false,
        });
        assert.strictEqual(res.valid, false, `Expected failure for case: ${tc.name}`);
        assert.ok(
          res.errors.some((e) => e.includes(tc.expectedError)),
          `Case "${tc.name}" must contain expected error "${tc.expectedError}", got: ${res.errors.join('; ')}`
        );
      }
    });

    it('rejects invalid or placeholder EAS project id in production mode', () => {
      const badEasEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://structural-project.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture_token_structural_valid_123',
        EXPO_PUBLIC_API_URL: 'https://api.structural-domain.com',
        EXPO_PUBLIC_EAS_PROJECT_ID: 'dummy-project-id-not-uuid',
      };

      const result = validateConfig({
        mode: 'production',
        env: badEasEnv,
        projectRoot: REPO_ROOT,
        checkNodeEngine: false,
      });

      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('EAS') || e.includes('UUID')));
    });
  });

  describe('Isolated Temp-Root Regressions (app.json / eas.json structure)', () => {
    function createTempWorkspace(overrides = {}) {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haseela-test-ws-'));
      const mobileDir = path.join(tempDir, 'apps', 'mobile');
      fs.mkdirSync(mobileDir, { recursive: true });

      const pkg = {
        name: '@haseela/mobile',
        version: '1.0.0',
        scripts: { lint: 'eslint .' },
        ...overrides.packageJson,
      };
      fs.writeFileSync(path.join(mobileDir, 'package.json'), JSON.stringify(pkg, null, 2));

      const appJson = {
        expo: {
          name: 'Haseela',
          slug: 'haseela',
          scheme: 'haseela',
          version: '1.0.0',
          android: {
            package: 'com.haseela.app',
            versionCode: 1,
            supportsRTL: true,
          },
          ios: {
            bundleIdentifier: 'com.haseela.app',
            buildNumber: '1',
            supportsRTL: true,
          },
          supportsRTL: true,
          ...overrides.expoConfig,
        },
      };
      fs.writeFileSync(path.join(mobileDir, 'app.json'), JSON.stringify(appJson, null, 2));

      const easJson = {
        cli: { appVersionSource: 'local' },
        build: {
          preview: {
            distribution: 'internal',
            android: { buildType: 'apk' },
          },
          production: {
            distribution: 'store',
            android: { buildType: 'app-bundle' },
            ios: {},
          },
        },
        ...overrides.easJson,
      };
      fs.writeFileSync(path.join(mobileDir, 'eas.json'), JSON.stringify(easJson, null, 2));

      fs.writeFileSync(path.join(tempDir, '.gitignore'), '.expo/\n.export-*/\n*.apk\n*.aab\n');

      return tempDir;
    }

    it('accepts legitimate version bumps in app.json', () => {
      const tempWs = createTempWorkspace({
        expoConfig: {
          version: '1.2.0',
          android: { package: 'com.haseela.app', versionCode: 42, supportsRTL: true },
          ios: { bundleIdentifier: 'com.haseela.app', buildNumber: '42', supportsRTL: true },
        },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, true);
    });

    it('rejects invalid semver version string in app.json', () => {
      const tempWs = createTempWorkspace({
        expoConfig: { version: 'invalid-version' },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('semver')));
    });

    it('rejects non-integer or non-positive android.versionCode in app.json', () => {
      const tempWs = createTempWorkspace({
        expoConfig: {
          android: { package: 'com.haseela.app', versionCode: 1.5, supportsRTL: true },
        },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('android.versionCode')));
    });

    it('rejects non-numeric ios.buildNumber in app.json', () => {
      const tempWs = createTempWorkspace({
        expoConfig: {
          ios: { bundleIdentifier: 'com.haseela.app', buildNumber: 'build-one', supportsRTL: true },
        },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('ios.buildNumber')));
    });

    it('rejects production build profile distribution if not "store"', () => {
      const tempWs = createTempWorkspace({
        easJson: {
          build: {
            preview: { distribution: 'internal', android: { buildType: 'apk' } },
            production: { distribution: 'internal', android: { buildType: 'app-bundle' }, ios: {} },
          },
        },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('production profile distribution must be "store"')));
    });

    it('rejects developmentClient: true in eas.json if expo-dev-client is not installed', () => {
      const tempWs = createTempWorkspace({
        easJson: {
          build: {
            preview: { distribution: 'internal', android: { buildType: 'apk' }, developmentClient: true },
            production: { distribution: 'store', android: { buildType: 'app-bundle' }, ios: {} },
          },
        },
      });

      const res = validateConfig({
        mode: 'static',
        projectRoot: tempWs,
        checkNodeEngine: false,
      });

      fs.rmSync(tempWs, { recursive: true, force: true });
      assert.strictEqual(res.valid, false);
      assert.ok(res.errors.some((e) => e.includes('developmentClient')));
    });
  });

  describe('Known Limitations Behavior & Truth', () => {
    it('declares essential unverified native, backend, and platform boundaries', () => {
      assert.ok(Array.isArray(KNOWN_LIMITATIONS));
      assert.ok(KNOWN_LIMITATIONS.length >= 5);

      const combined = KNOWN_LIMITATIONS.join('\n');
      assert.ok(/Firebase\/APNs/i.test(combined), 'Must mention Firebase/APNs');
      assert.ok(/Live Backend/i.test(combined), 'Must mention Live Backend/RLS');
      assert.ok(/Physical Device/i.test(combined), 'Must mention Physical Device testing');
      assert.ok(/Branding Assets/i.test(combined), 'Must mention Branding Assets verification');
      assert.ok(/Backend Deletion/i.test(combined), 'Must mention Backend Deletion status');
      assert.ok(/Auth Scope/i.test(combined), 'Must mention Auth review scope status');
    });
  });

  describe('CLI Execution & Output Sanitization', () => {
    it('runCli in static mode succeeds with exit code 0 on valid CI config', () => {
      const syntheticCiEnv = {
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'ci-anon-placeholder',
        EXPO_PUBLIC_API_URL: 'https://example.com',
      };
      const origLog = console.log;
      let logs = '';
      console.log = (...args) => {
        logs += args.join(' ') + '\n';
      };
      try {
        const exitCode = runCli(['--static'], syntheticCiEnv);
        assert.strictEqual(exitCode, 0);
        assert.ok(logs.includes('STATIC STRUCTURAL CHECK PASSED'));
      } finally {
        console.log = origLog;
      }
    });

    it('runCli in production mode fails with exit code 1 on bad input without leaking secrets or sentinels', () => {
      const sentinel = 'LEAK_CHECK_SENTINEL_554433';
      const badEnv = {
        EXPO_PUBLIC_SUPABASE_URL: `https://user:${sentinel}@api.structural-domain.com`,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: makeSyntheticJwt({ role: sentinel }),
        EXPO_PUBLIC_API_URL: 'https://',
      };
      const origLog = console.log;
      let logs = '';
      console.log = (...args) => {
        logs += args.join(' ') + '\n';
      };
      try {
        const exitCode = runCli(['--production'], badEnv);
        assert.strictEqual(exitCode, 1);
        assert.ok(logs.includes('Configuration Validation FAILED'));
        assert.strictEqual(logs.includes(sentinel), false, 'runCli output must never leak sentinel or credential values');
      } finally {
        console.log = origLog;
      }
    });
  });
});
