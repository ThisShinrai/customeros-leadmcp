import Link from 'next/link';
import { Mail } from 'lucide-react';

/**
 * Invites are delivered as one-click magic links (no token form needed).
 * This route stays as a graceful fallback for any old/legacy invite URL.
 */
export default function InvitePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 440 }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, background: '#fff', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Mail size={22} />
      </div>
      <div style={{ background: '#fff', borderRadius: 20, padding: 40, width: '100%', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.5px', margin: '0 0 8px' }}>Prüfen Sie Ihr Postfach</h1>
        <p style={{ fontSize: 14, color: '#909090', lineHeight: 1.55, margin: '0 0 24px' }}>
          Ihre Einladung wurde als sicherer Magic-Link per E-Mail verschickt. Öffnen Sie einfach den Link aus der E-Mail – kein Passwort nötig.
        </p>
        <Link href="/app/a/login" style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', background: '#0A0A0A', color: '#fff', borderRadius: 100, padding: '13px', fontWeight: 700, fontSize: 14 }}>
          Zur Anmeldung
        </Link>
      </div>
    </div>
  );
}
