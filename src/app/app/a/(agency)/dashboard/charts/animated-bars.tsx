'use client';

import { useState } from 'react';
import { usePrefersReducedMotion, useReveal } from './use-reveal';

export interface BarDatum {
  label: string;
  value: number;
  /** Optional per-bar color; defaults to accent. */
  color?: string;
}

interface AnimatedBarsProps {
  data: BarDatum[];
  /** Chart plot height in px (excludes labels). */
  height?: number;
  /** Force a max for the y-scale; otherwise the largest value is used. */
  max?: number;
}

const EASE = 'cubic-bezier(.16,1,.3,1)';

/**
 * Vertical bar chart. Each bar's height animates from 0 → its scaled value with
 * a per-bar stagger so they rise in sequence. Hovering a bar darkens it and
 * surfaces the value chip. Reduced-motion → bars render at final height.
 */
export function AnimatedBars({ data, height = 132, max }: AnimatedBarsProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useReveal<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const peak = Math.max(max ?? 0, ...data.map((d) => d.value), 1);
  const animate = shown && !reduced;

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: height + 26 }}>
      {data.map((d, i) => {
        const pct = (d.value / peak) * 100;
        const barColor = d.color ?? 'var(--accent)';
        const isHover = hover === i;
        return (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              height: '100%',
              justifyContent: 'flex-end',
              cursor: 'default',
            }}
          >
            {/* Value chip */}
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: isHover ? '#0A0A0A' : '#909090',
                fontVariantNumeric: 'tabular-nums',
                transition: `color .2s ${EASE}, opacity .4s ${EASE}`,
                opacity: animate || reduced ? 1 : 0,
                lineHeight: 1,
              }}
            >
              {d.value}
            </span>
            {/* Bar track */}
            <div style={{ width: '100%', maxWidth: 52, height, display: 'flex', alignItems: 'flex-end', borderRadius: 10, background: '#F4F3F0' }}>
              <div
                style={{
                  width: '100%',
                  height: animate || reduced ? `${pct}%` : '0%',
                  minHeight: d.value > 0 ? 5 : 0,
                  background: barColor,
                  borderRadius: 10,
                  opacity: isHover ? 1 : 0.92,
                  filter: isHover ? 'brightness(.82)' : 'none',
                  transition: `height .85s ${EASE} ${0.1 + i * 0.07}s, filter .2s ${EASE}, opacity .2s ${EASE}`,
                }}
              />
            </div>
            {/* Label */}
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: isHover ? '#0A0A0A' : '#909090',
                textAlign: 'center',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
                transition: `color .2s ${EASE}`,
              }}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
