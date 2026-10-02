'use client';

import { useEffect, useRef, useState } from 'react';
import { usePrefersReducedMotion, useReveal } from './use-reveal';

interface CountUpProps {
  /** Target value to animate toward. */
  value: number;
  /** Animation length in ms. */
  duration?: number;
  /** Decimal places to render. */
  decimals?: number;
  /** Rendered before the number. */
  prefix?: string;
  /** Rendered after the number. */
  suffix?: string;
  /** Custom formatter — overrides decimals/prefix/suffix. Receives the live value. */
  format?: (value: number) => string;
  className?: string;
  style?: React.CSSProperties;
}

/** easeOutExpo — fast start, gentle settle. Matches cubic-bezier(.16,1,.3,1) feel. */
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/**
 * Animates 0 → `value` on mount/scroll-in via requestAnimationFrame.
 * Renders tabular-nums so the width never jitters. Honors reduced-motion by
 * jumping straight to the final value.
 */
export function CountUp({
  value,
  duration = 1100,
  decimals = 0,
  prefix = '',
  suffix = '',
  format,
  className,
  style,
}: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useReveal<HTMLSpanElement>();
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shown) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const delta = value - from;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(from + delta * easeOutExpo(t));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [shown, reduced, value, duration]);

  const rendered = format
    ? format(display)
    : `${prefix}${display.toLocaleString('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {rendered}
    </span>
  );
}
