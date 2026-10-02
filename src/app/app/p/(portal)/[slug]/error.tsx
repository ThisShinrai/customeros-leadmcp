'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[portal error]', error); }, [error]);

  return (
    <div style={{ minHeight: '100vh', background: '#0e0e0e', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 22, padding: '44px 40px', maxWidth: 420, textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,.3)' }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FEF2F2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
          <AlertTriangle size={24} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 8px' }}>Etwas ist schiefgelaufen</h1>
        <p style={{ fontSize: 14.5, color: '#909090', lineHeight: 1.55, margin: '0 0 24px' }}>
          Bitte versuchen Sie es erneut. Falls das Problem bestehen bleibt, wenden Sie sich an Ihre Ansprechpartner.
        </p>
        <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent)', color: '#fff', borderRadius: 100, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          <RotateCw size={15} /> Erneut versuchen
        </button>
      </div>
    </div>
  );
}
