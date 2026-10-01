const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo (e.g. packages/shared)
config.watchFolders = [monorepoRoot];

// Resolve node_modules first in apps/mobile (React 19), then in root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Supabase JS 2.106+ uses dynamic import(variable) in ESM dist/index.mjs for opentelemetry,
// which is unsupported by Hermes bytecode compiler. Route to CJS build instead.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@supabase/supabase-js') {
    return context.resolveRequest(
      context,
      '@supabase/supabase-js/dist/index.cjs',
      platform
    );
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
