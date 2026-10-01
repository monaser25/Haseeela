/**
 * Minimal semver helpers used for the mobile force-update check.
 * Only `MAJOR.MINOR.PATCH` is compared; a leading `v` and any `-prerelease` /
 * `+build` suffix are ignored. Returns null for strings that are not versions.
 */
export const DEFAULT_MIN_MOBILE_VERSION = '1.0.0';

export const parseVersion = (value: string): [number, number, number] | null => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * True when `current` is strictly lower than `min`. Fails open (false) when
 * either value is not a valid version, so a bad config never locks users out.
 */
export const isVersionBelow = (current: string, min: string): boolean => {
  const a = parseVersion(current);
  const b = parseVersion(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
};
