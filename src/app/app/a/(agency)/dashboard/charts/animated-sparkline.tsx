'use client';

import { useId } from 'react';
import { usePrefersReducedMotion, useReveal } from './use-reveal';

interface AnimatedSparklineProps {
  /** Raw series values, left → right. */
  data: number[];
  /** Render width in px (SVG is responsive — scales to container). */
  width?: number;
  /** Render height in px. */
  height?: number;
  /** Stroke color; defaults to accent. */
  color?: string;
  /** Show the dot at the latest point. */
  showEnd?: boolean;
}

const EASE = 'cubic-bezier(.16,1,.3,1)';

/** Build a smooth-ish polyline path + a closed area path from values. */
function buildPaths(data: number[], w: number, h: number, pad: number) {
  const n = data.length;
  if (n === 0) return { line: '', area: '', last: { x: 0, y: h / 2 } };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;

  const pts = data.map((v, i) => {
    const x = pad + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
    const y = pad + innerH - ((v - min) / span) * innerH;
    return { x, y };
  });

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${pts[n - 1].x.toFixed(2)},${(h - pad).toFixed(2)} L${pts[0].x.toFixed(2)},${(h - pad).toFixed(2)} Z`;
  return { line, area, last: pts[n - 1] };
}

/**
 * Trend sparkline with an accent stroke that draws left → right (animated
 * stroke-dashoffset) and a soft gradient area fill that fades in beneath it.
 * Reduced-motion → fully drawn line, no animation.
 */
export function AnimatedSparkline({
  data,
  width = 320,
  height = 80,
  color = 'var(--accent)',
  showEnd = true,
}: AnimatedSparklineProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, shown } = useReveal<HTMLDivElement>();
  const gradId = useId();
  const pad = 6;

  const { line, area, last } = buildPaths(data, width, height, pad);
  const animate = shown && !reduced;
  // Generous dash length so the whole path is covered regardless of geometry.
  const dash = (width + height) * 2;

  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        {area && (
          <path
            d={area}
            fill={`url(#${gradId})`}
            style={{
              opacity: animate || reduced ? 1 : 0,
              transition: animate ? `opacity .7s ${EASE} .35s` : 'none',
            }}
          />
        )}

        {/* Stroke line — draws on */}
        {line && (
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={dash}
            strokeDashoffset={animate ? 0 : reduced ? 0 : dash}
            style={{
              transition: animate ? `stroke-dashoffset 1.1s ${EASE} .1s` : 'none',
            }}
          />
        )}

        {/* End dot */}
        {showEnd && line && (
          <circle
            cx={last.x}
            cy={last.y}
            r={3.5}
            fill={color}
            stroke="#fff"
            strokeWidth={2}
            style={{
              opacity: animate || reduced ? 1 : 0,
              transition: animate ? `opacity .4s ${EASE} 1.05s` : 'none',
            }}
          />
        )}
      </svg>
    </div>
  );
}
