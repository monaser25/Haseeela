import { useEffect, useState } from 'react';

/**
 * Hook to detect whether the user has requested reduced motion via OS/browser settings.
 * Safe for SSR (defaults to false until mounted).
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook that counts up from 0 to target value on mount with ease-out curve.
 * Staggered delay supported.
 * If prefers-reduced-motion is true, immediately returns target.
 */
export function useCountUp(target: number, durationMs = 600, delayMs = 0): number {
  const prefersReduced = usePrefersReducedMotion();
  const [value, setValue] = useState(prefersReduced ? target : 0);

  useEffect(() => {
    if (prefersReduced) {
      setValue(target);
      return;
    }

    let startTimestamp: number | null = null;
    let animId: number;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    const startAnimation = () => {
      const step = (timestamp: number) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const elapsed = timestamp - startTimestamp;
        const progress = Math.min(elapsed / durationMs, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(eased * target));

        if (progress < 1) {
          animId = requestAnimationFrame(step);
        }
      };
      animId = requestAnimationFrame(step);
    };

    if (delayMs > 0) {
      timerId = setTimeout(startAnimation, delayMs);
    } else {
      startAnimation();
    }

    return () => {
      if (timerId) clearTimeout(timerId);
      if (animId) cancelAnimationFrame(animId);
    };
  }, [target, durationMs, delayMs, prefersReduced]);

  return prefersReduced ? target : value;
}
