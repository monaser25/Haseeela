import { lightColors, darkColors, ColorTokens } from '../colors';
import { lightGradients, darkGradients } from '../gradients';

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const AA = 4.5;

const schemes: Array<[string, ColorTokens, typeof lightGradients]> = [
  ['light', lightColors, lightGradients],
  ['dark', darkColors, darkGradients],
];

describe.each(schemes)('%s palette meets WCAG AA for text', (_name, c, gradients) => {
  it.each([
    ['text', 'bg'],
    ['text', 'surface'],
    ['textSecondary', 'bg'],
    ['textSecondary', 'surface'],
    ['textSecondary', 'surfaceHover'],
    ['textMuted', 'bg'],
    ['textMuted', 'surface'],
    ['textMuted', 'surfaceElevated'],
    ['textMuted', 'surfaceHover'],
    ['accentText', 'bg'],
    ['accentText', 'surface'],
    ['accentText', 'accentTint'],
    ['accentFg', 'accent'],
    ['positiveText', 'bg'],
    ['positiveText', 'surface'],
    ['positiveText', 'positiveTint'],
    ['negativeText', 'bg'],
    ['negativeText', 'surface'],
    ['negativeText', 'negativeTint'],
    ['warningText', 'bg'],
    ['warningText', 'surface'],
    ['warningText', 'warningTint'],
    ['infoText', 'surface'],
    ['infoText', 'infoTint'],
  ] as const)('%s on %s', (fg, bg) => {
    expect(contrast(c[fg], c[bg])).toBeGreaterThanOrEqual(AA);
  });

  it('keeps hero text readable on every hero gradient stop', () => {
    for (const stop of gradients.hero) {
      expect(contrast(c.onHero, stop)).toBeGreaterThanOrEqual(AA);
      expect(contrast(c.onHeroMuted, stop)).toBeGreaterThanOrEqual(AA);
    }
  });
});
