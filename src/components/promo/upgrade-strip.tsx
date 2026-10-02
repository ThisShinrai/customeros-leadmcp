'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';

interface UpgradeStripProps {
  plan: string;
  adsDisabled: boolean;
}

const DISMISS_KEY = 'cos-promo-dismissed';

/**
 * Slim, dismissible upgrade banner. Renders only for the free plan when the
 * paid "Werbefrei" add-on is off. Dismissal persists for the session
 * (sessionStorage), and the component is safe to render at the top of a page.
 */
export function UpgradeStrip({ plan, adsDisabled }: UpgradeStripProps) {
  const eligible = !adsDisabled && plan === 'free';
  // Start hidden to avoid SSR/client flash; reveal after we've read sessionStorage.
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!eligible) return;
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    } catch {
      setDismissed(false); // sessionStorage unavailable → show the strip
    }
  }, [eligible]);

  if (!eligible || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore — non-persisting dismissal is acceptable */
    }
  }

  return (
    <div
      role="region"
      aria-label="Upgrade-Hinweis"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '11px 16px',
        borderRadius: 14,
        marginBottom: 18,
        fontFamily: 'inherit',
        border: '1px solid rgba(var(--accent-rgb), .22)',
        background:
          'linear-gradient(100deg, rgba(var(--accent-rgb), .12), rgba(var(--accent-rgb), .04) 60%, transparent)',
        animation: 'cardIn .5s var(--ease) both',
      }}
    >
      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.5, flex: 1, minWidth: 0 }}>
        <span aria-hidden style={{ marginRight: 6 }}>✨</span>
        Hol dir{' '}
        <strong style={{ fontWeight: 700 }}>epssys Pro</strong>
        {' '}— unbegrenzte Projekte, eigenes Branding, kein epssys-Logo.
      </span>

      <Link
        href="/app/a/settings"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          borderRadius: 100,
          padding: '7px 16px',
          fontSize: 13,
          fontWeight: 700,
          textDecoration: 'none',
          background: 'var(--accent)',
          color: '#fff',
          transition: 'transform .14s var(--ease)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        Upgrade
      </Link>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Hinweis ausblenden"
        title="Ausblenden"
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          background: 'transparent',
          color: 'var(--faint)',
          cursor: 'pointer',
          transition: 'background .14s var(--ease), color .14s var(--ease)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(var(--accent-rgb), .12)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--faint)';
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
