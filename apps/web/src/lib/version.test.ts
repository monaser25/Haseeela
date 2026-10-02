import { isVersionBelow, parseVersion } from '@haseela/shared/lib/version';

describe('isVersionBelow', () => {
  it.each([
    ['1.0.0', '1.0.1', true],
    ['1.0.9', '1.1.0', true],
    ['1.9.9', '2.0.0', true],
    ['0.9.0', '1.0.0', true],
    ['1.0.0', '1.0.0', false],
    ['1.0.1', '1.0.0', false],
    ['1.10.0', '1.9.0', false],
    ['2.0.0', '1.99.99', false],
    ['v1.2.3', '1.2.4', true],
    ['1.2.3-beta.1', '1.2.3', false],
    ['1.2.3+build.5', '1.2.4', true],
  ])('isVersionBelow(%s, %s) -> %s', (current, min, expected) => {
    expect(isVersionBelow(current, min)).toBe(expected);
  });

  it('fails open on invalid input', () => {
    expect(isVersionBelow('garbage', '1.0.0')).toBe(false);
    expect(isVersionBelow('1.0.0', '')).toBe(false);
    expect(isVersionBelow('1.0', '1.0.1')).toBe(false);
  });

  it('parseVersion returns null for non-versions', () => {
    expect(parseVersion('1.2.3')).toEqual([1, 2, 3]);
    expect(parseVersion('abc')).toBeNull();
  });
});
