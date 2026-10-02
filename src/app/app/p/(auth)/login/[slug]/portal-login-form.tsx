'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { authClient } from '@/lib/auth/client';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '#909090',
  marginBottom: 6,
};

const errorBoxStyle: React.CSSProperties = {
  background: '#FFF0F0',
  border: '1px solid #FFD0D0',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 13,
  color: '#cc0000',
  marginBottom: 16,
};

interface PortalLoginFormProps {
  slug: string;
  /** Text color rendered on top of the accent button (white-label). */
  accentText: string;
  agencyName: string;
}

export function PortalLoginForm({ slug, accentText, agencyName }: PortalLoginFormProps) {
  const router = useRouter();
  const callbackURL = `/app/p/${slug}`;

  // Magic link (primary) state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  // Optional email/password state
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicLoading(true);
    setMagicError('');
    const { error: err } = await authClient.signIn.magicLink({ email: magicEmail, callbackURL });
    if (err) {
      setMagicError(err.message || 'Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
      setMagicLoading(false);
    } else {
      setMagicSent(true);
      setMagicLoading(false);
    }
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await authClient.signIn.email({ email, password, callbackURL });
    if (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.');
      setLoading(false);
    } else {
      router.push(callbackURL);
    }
  }

  // Success state — magic link sent.
  if (magicSent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'rgba(var(--accent-rgb), .1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <MailCheck size={34} color="var(--accent)" strokeWidth={1.9} />
        </div>
        <h2 style={{ fontSize: 19, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.4px', margin: '0 0 8px' }}>
          Schauen Sie in Ihr Postfach
        </h2>
        <p style={{ fontSize: 14, color: '#909090', lineHeight: 1.6, margin: '0 0 22px', maxWidth: 300 }}>
          Wir haben einen Anmeldelink an <strong style={{ color: '#505050' }}>{magicEmail}</strong> gesendet.
          Der Link ist 15 Minuten gültig.
        </p>
        <button
          type="button"
          onClick={() => {
            setMagicSent(false);
            setMagicError('');
          }}
          style={{
            fontSize: 13,
            color: '#909090',
            background: 'transparent',
            border: '1.5px solid #E4E3DF',
            borderRadius: 100,
            padding: '10px 20px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            transition: 'background .14s, color .14s',
          }}
        >
          Anderen Link anfordern
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#0A0A0A',
          letterSpacing: '-0.5px',
          margin: '0 0 4px',
        }}
      >
        Anmelden
      </h2>
      <p style={{ fontSize: 14, color: '#909090', margin: '0 0 24px' }}>
        Erhalten Sie einen sicheren Link per E-Mail – kein Passwort nötig.
      </p>

      {/* Magic Link — primary */}
      {magicError && <div style={errorBoxStyle}>{magicError}</div>}
      <form onSubmit={handleMagicLink}>
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>E-Mail-Adresse</label>
          <input
            type="email"
            required
            autoFocus
            value={magicEmail}
            onChange={(e) => setMagicEmail(e.target.value)}
            placeholder="ihre@email.de"
            className="cos-input"
          />
        </div>
        <button
          type="submit"
          disabled={magicLoading}
          style={{
            width: '100%',
            background: 'var(--accent)',
            color: accentText,
            borderRadius: 100,
            padding: '13px',
            fontWeight: 700,
            fontSize: 14,
            border: 'none',
            cursor: magicLoading ? 'default' : 'pointer',
            fontFamily: 'Inter, sans-serif',
            opacity: magicLoading ? 0.6 : 1,
            transition: 'transform .14s cubic-bezier(.16,1,.3,1), opacity .14s',
          }}
          onMouseEnter={(e) => {
            if (!magicLoading) e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {magicLoading ? 'Wird gesendet…' : 'Magic Link senden'}
        </button>
      </form>

      {/* Toggle to optional password login */}
      {!showPassword ? (
        <button
          type="button"
          onClick={() => setShowPassword(true)}
          style={{
            display: 'block',
            margin: '18px auto 0',
            background: 'transparent',
            border: 'none',
            fontSize: 13,
            color: '#909090',
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          Stattdessen mit Passwort anmelden
        </button>
      ) : (
        <>
          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E4E3DF' }} />
            <span style={{ fontSize: 12, color: '#b0b0b0', fontWeight: 500 }}>oder mit Passwort</span>
            <div style={{ flex: 1, height: 1, background: '#E4E3DF' }} />
          </div>

          {error && <div style={errorBoxStyle}>{error}</div>}
          <form onSubmit={handlePasswordLogin}>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.de"
                className="cos-input"
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Passwort</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="cos-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#fff',
                color: '#0A0A0A',
                border: '1.5px solid #E4E3DF',
                borderRadius: 100,
                padding: '13px',
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? 'default' : 'pointer',
                fontFamily: 'Inter, sans-serif',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Wird angemeldet…' : 'Anmelden'}
            </button>
          </form>
        </>
      )}

      <p style={{ marginTop: 22, fontSize: 12, color: '#b0b0b0', textAlign: 'center', lineHeight: 1.5 }}>
        Geschützter Zugang zum Portal von {agencyName}.
      </p>
    </div>
  );
}
