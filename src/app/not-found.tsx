import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', background: '#0A0A0A', color: '#F4F3F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 90, fontWeight: 800, letterSpacing: '-4px', lineHeight: 1, marginBottom: 8 }}>404</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.6px', margin: '0 0 10px' }}>Seite nicht gefunden</h1>
        <p style={{ fontSize: 15, color: 'rgba(244,243,240,.55)', lineHeight: 1.55, margin: '0 0 28px' }}>
          Die gesuchte Seite existiert nicht oder wurde verschoben.
        </p>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', color: '#0A0A0A', borderRadius: 100, padding: '13px 26px', fontSize: 15, fontWeight: 700 }}>
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
