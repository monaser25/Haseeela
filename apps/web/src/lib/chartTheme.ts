'use client';

import { useEffect, useState } from 'react';

export const CHART_SERIES_VARS = [
  '--accent',
  '--positive',
  '--warning',
  '--info',
  '--viz-5',
  '--viz-6',
  '--viz-7',
] as const;

export const FALLBACK_CHART_SERIES = [
  'var(--accent)',
  'var(--positive)',
  'var(--warning)',
  'var(--info)',
  'var(--viz-5)',
  'var(--viz-6)',
  'var(--viz-7)',
];

export function getComputedChartSeries(): string[] {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_CHART_SERIES;
  }
  const style = getComputedStyle(document.documentElement);
  return CHART_SERIES_VARS.map((v) => style.getPropertyValue(v).trim() || `var(${v})`);
}

/**
 * Live array of chart series colors read from getComputedStyle(document.documentElement).
 * Automatically resolves light/dark mode and token CSS vars without hardcoded hex.
 * Safe for SSR.
 */
export const CHART_SERIES: string[] = new Proxy(FALLBACK_CHART_SERIES, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && !isNaN(Number(prop))) {
      const idx = Number(prop);
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const computed = getComputedChartSeries();
        return computed[idx % computed.length];
      }
      return target[idx % target.length];
    }
    if (prop === 'length') {
      return FALLBACK_CHART_SERIES.length;
    }
    if (prop === Symbol.iterator) {
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const computed = getComputedChartSeries();
        return computed[Symbol.iterator].bind(computed);
      }
      return target[Symbol.iterator].bind(target);
    }
    return Reflect.get(target, prop, receiver);
  },
});

export const CHART_TOKENS = {
  accent: 'var(--accent)',
  positive: 'var(--positive)',
  negative: 'var(--negative)',
  warning: 'var(--warning)',
  pending: 'var(--pending)',
  info: 'var(--info)',
  border: 'var(--border)',
  borderStrong: 'var(--border-strong)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',
  surface: 'var(--surface)',
  surfaceElevated: 'var(--surface-elevated)',
  surfaceHover: 'var(--surface-hover)',
} as const;

/**
 * React hook that re-evaluates computed styles whenever the DOM class/style changes
 * (e.g. on dark mode toggle).
 */
export function useChartTheme() {
  const [series, setSeries] = useState<string[]>(() => getComputedChartSeries());

  useEffect(() => {
    setSeries(getComputedChartSeries());
    const observer = new MutationObserver(() => {
      setSeries(getComputedChartSeries());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  return { series, tokens: CHART_TOKENS };
}
