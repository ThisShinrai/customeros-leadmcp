'use client';

import { CountUp } from './count-up';
import { usePrefersReducedMotion, useReveal } from './use-reveal';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface AnimatedDonutProps {
  segments: DonutSegment[];
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  /** Small label under the center total. */
  centerLabel?: string;
}

const EASE = 'cubic-bezier(.16,1,.3,1)';

/**
 * SVG donut chart. Each segment's stroke "draws on" by animating
 * stroke-dasharray from 0 → its arc length, staggered so the ring fills
 * clockwise. Center shows the animated total. Reduced-motion → static full ring.
 */
export function AnimatedDonut({
  segments,
  size = 168,
  thickness = 20,
  centerLabel = 'Projekte',
}: AnimatedDonutProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useReveal<HTMLDivElement>();

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const animate = shown && !reduced;

  // Walk segments to compute each arc's length + rotation offset.
  let acc = 0;
  const arcs = segments.map((seg, i) => {
    const fraction = total > 0 ? seg.value / total : 0;
    const length = fraction * circumference;
    const rotation = total > 0 ? (acc / total) * 360 : 0;
    acc += seg.value;
    // 4px visual gap between segments (only when >1 non-zero segment).
    const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
    return { seg, i, length: Math.max(length - gap, 0), rotation, delay: 0.12 + i * 0.13 };
  });

  return (
    <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#EDECE9"
            strokeWidth={thickness}
          />
          {total > 0 &&
            arcs.map(({ seg, i, length, rotation, delay }) => (
              <circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                strokeDasharray={`${length} ${circumference}`}
                strokeDashoffset={animate ? 0 : length}
                style={{
                  transform: `rotate(${rotation - 90}deg)`,
                  transformOrigin: 'center',
                  transition: animate
                    ? `stroke-dashoffset .9s ${EASE} ${delay}s`
                    : 'none',
                }}
              />
            ))}
        </svg>
        {/* Center total */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CountUp
            value={total}
            style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-1.6px', color: '#0A0A0A', lineHeight: 1 }}
          />
          <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: '#909090', marginTop: 4 }}>
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 120, flex: 1 }}>
        {segments.map((seg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              opacity: animate ? 1 : reduced ? 1 : 0,
              transform: animate || reduced ? 'translateX(0)' : 'translateX(-6px)',
              transition: `opacity .5s ${EASE} ${0.3 + i * 0.08}s, transform .5s ${EASE} ${0.3 + i * 0.08}s`,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: '#505050', fontWeight: 500, flex: 1, whiteSpace: 'nowrap' }}>{seg.label}</span>
            <span style={{ fontSize: 12.5, color: '#0A0A0A', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
