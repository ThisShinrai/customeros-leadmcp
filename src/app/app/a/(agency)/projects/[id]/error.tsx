'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[project error]', error); }, [error]);

  return (
    <div style={{ minHeight: 'calc(100vh - 16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <AlertTriangle size={24} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 8px' }}>Etwas ist schiefgelaufen</h1>
        <p style={{ fontSize: 14.5, color: '#909090', lineHeight: 1.55, margin: '0 0 24px' }}>
          Dieses Projekt konnte nicht geladen werden. Versuchen Sie es erneut oder kehren Sie zur Projektübersicht zurück.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            <RotateCw size={15} /> Erneut versuchen
          </button>
          <Link href="/app/a/projects" style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', color: '#0A0A0A', border: '1.5px solid #E4E3DF', borderRadius: 100, padding: '11px 20px', fontSize: 14, fontWeight: 600 }}>
            Zu den Projekten
          </Link>
        </div>
      </div>
    </div>
  );
}
