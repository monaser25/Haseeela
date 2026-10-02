/**
 * Dynamic Expo configuration for Haseela mobile.
 * Merges static app.json with validated dynamic EAS / environment settings.
 * Does NOT read .env.local.
 * Does NOT set dummy project IDs or fake OTA update URLs.
 * Push registration needs `extra.eas.projectId`; it is only set when EXPO_PUBLIC_EAS_PROJECT_ID is a valid
 * UUID (i.e. after `eas init` links the project). Until then the app skips push registration.
 */
module.exports = ({ config: baseConfig }) => {
  // Push notifications: the expo-notifications config plugin wires the native modules and the Android
  // default channel. No google-services.json / credentials are added here; those are supplied at EAS
  // build time. Added here (not app.json) so it is applied on top of whatever app.json declares.
  const hasPlugin = (list, name) =>
    list.some((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);
  const basePlugins = baseConfig.plugins || [];
  const config = {
    ...baseConfig,
    plugins: hasPlugin(basePlugins, 'expo-notifications')
      ? basePlugins
      : [...basePlugins, ['expo-notifications', { color: '#6D5EFC' }]],
  };

  const rawProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const isUuid = (val) =>
    typeof val === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

  let hasExpoUpdates = false;
  try {
    const pkg = require('./package.json');
    hasExpoUpdates = Boolean(
      (pkg.dependencies && pkg.dependencies['expo-updates']) ||
      (pkg.devDependencies && pkg.devDependencies['expo-updates'])
    );
  } catch {
    hasExpoUpdates = false;
  }

  const extra = { ...(config.extra || {}) };

  // Only merge projectId if valid UUID format, absent means unlinked not a dummy value
  if (rawProjectId && isUuid(rawProjectId)) {
    const validProjectId = rawProjectId.trim();
    extra.eas = {
      ...(extra.eas || {}),
      projectId: validProjectId,
    };

    // Conditional OTA config: only enable when actual valid projectId AND direct expo-updates dependency exists
    if (hasExpoUpdates) {
      return {
        ...config,
        extra,
        updates: {
          url: `https://u.expo.dev/${validProjectId}`,
          ...(config.updates || {}),
        },
      };
    }
  }

  return {
    ...config,
    ...(Object.keys(extra).length > 0 ? { extra } : {}),
  };
};
