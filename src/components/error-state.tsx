'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function ErrorState({ error, reset, description, backHref, backLabel }: ErrorStateProps) {
  useEffect(() => { console.error('[error]', error); }, [error]);

  return (
    <div style={{ minHeight: 'calc(100vh - 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <AlertTriangle size={24} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 8px' }}>Etwas ist schiefgelaufen</h1>
        <p style={{ fontSize: 14.5, color: '#909090', lineHeight: 1.55, margin: '0 0 24px' }}>
          {description ?? 'Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, wenden Sie sich an den Support.'}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <RotateCw size={15} /> Erneut versuchen
          </button>
          {backHref && (
            <Link href={backHref} style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', color: '#0A0A0A', border: '1.5px solid #E4E3DF', borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600 }}>
              {backLabel ?? 'Zurück'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
