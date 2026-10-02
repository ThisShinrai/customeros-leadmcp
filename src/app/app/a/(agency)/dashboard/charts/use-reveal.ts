'use client';

import { useEffect, useRef, useState } from 'react';

/** True once the user has `prefers-reduced-motion: reduce` set. SSR-safe (false on server). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

interface RevealOptions {
  /** Fraction of the element visible before it counts as "in view". */
  threshold?: number;
  /** Only fire once (default true). */
  once?: boolean;
}

/**
 * Returns a ref + `shown` flag that flips to true when the element scrolls into
 * view. Used to gate chart draw-on animations. Falls back to immediately-true
 * when IntersectionObserver is unavailable (older runtimes / SSR hydration).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  { threshold = 0.25, once = true }: RevealOptions = {},
): { ref: React.RefObject<T | null>; shown: boolean } {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            if (once) obs.disconnect();
          } else if (!once) {
            setShown(false);
          }
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);

  return { ref, shown };
}
