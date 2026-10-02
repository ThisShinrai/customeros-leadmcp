'use client';

import React from 'react';

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  dark?: boolean;
  interactive?: boolean;
  padding?: number | string;
}

/** Premium card with mouse-tracking shine + lift + accent glow on hover. */
export function BentoCard({ children, dark, interactive = true, padding = 22, className, style, ...rest }: BentoCardProps) {
  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    e.currentTarget.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    rest.onMouseMove?.(e);
  }
  return (
    <div
      {...rest}
      onMouseMove={onMove}
      className={`${interactive ? (dark ? 'bento bento-dark' : 'bento') : ''} ${className || ''}`}
      style={{
        borderRadius: 20,
        padding,
        background: dark ? '#0A0A0A' : '#fff',
        border: dark ? '1px solid rgba(255,255,255,.08)' : '1px solid #E4E3DF',
        color: dark ? '#fff' : 'var(--ink)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
