import Link from 'next/link';
import { MailCheck } from 'lucide-react';

export default function MagicLinkSentPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 440 }}>
      {/* Logo + Title above card */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: '#fff',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          fontWeight: 900,
          marginBottom: 14,
          flexShrink: 0,
        }}
      >
        C
      </div>
      <div
        style={{
          color: '#fff',
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '-0.4px',
          marginBottom: 24,
        }}
      >
        epssys
      </div>

      {/* Card */}
      <div
        style={{
          background: '#fff',
          borderRadius: 20,
          padding: 40,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        {/* Icon circle */}
        <div
          style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: '#F4F3F0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <MailCheck size={40} color="#0A0A0A" strokeWidth={1.75} />
        </div>

        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#0A0A0A',
            letterSpacing: '-0.5px',
            marginBottom: 10,
            marginTop: 0,
          }}
        >
          Schauen Sie in Ihr Postfach
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#909090',
            lineHeight: 1.6,
            marginBottom: 32,
            marginTop: 0,
            maxWidth: 300,
          }}
        >
          Wir haben Ihnen einen Anmeldelink gesendet. Der Link ist 15 Minuten gültig.
        </p>

        <Link
          href="/app/a/login"
          style={{
            fontSize: 13,
            color: '#909090',
            textDecoration: 'none',
            border: '1.5px solid #E4E3DF',
            borderRadius: 100,
            padding: '10px 20px',
            fontWeight: 600,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Anderen Link anfordern
        </Link>
      </div>
    </div>
  );
}
