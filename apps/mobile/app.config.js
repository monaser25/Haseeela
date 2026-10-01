/**
 * Dynamic Expo configuration for Haseela mobile.
 * Merges static app.json with validated dynamic EAS / environment settings.
 * Does NOT read .env.local.
 * Does NOT set dummy project IDs or fake OTA update URLs.
 */
module.exports = ({ config }) => {
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
