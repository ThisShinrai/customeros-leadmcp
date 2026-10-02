'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #E4E3DF',
  borderRadius: 12,
  padding: '11px 14px',
  fontSize: 14,
  color: '#0A0A0A',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'Inter, sans-serif',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  color: '#fff',
  borderRadius: 100,
  padding: '13px',
  fontWeight: 700,
  fontSize: 14,
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'Inter, sans-serif',
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

export default function LoginPage() {
  const router = useRouter();

  // Email/password state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Magic link state
  const [magicEmail, setMagicEmail] = useState('');
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState('');
  const [magicSent, setMagicSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await authClient.signIn.email({
      email,
      password,
      callbackURL: '/app/a/dashboard',
    });
    if (err) {
      setError(err.message || 'Anmeldung fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.');
      setLoading(false);
    } else {
      router.push('/app/a/dashboard');
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setMagicLoading(true);
    setMagicError('');
    const { error: err } = await authClient.signIn.magicLink({
      email: magicEmail,
      callbackURL: '/app/a/dashboard',
    });
    if (err) {
      setMagicError(err.message || 'Link konnte nicht gesendet werden. Bitte versuchen Sie es erneut.');
      setMagicLoading(false);
    } else {
      router.push('/app/a/magic-link-sent');
    }
  }

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
        }}
      >
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#0A0A0A',
            letterSpacing: '-0.5px',
            marginBottom: 4,
            marginTop: 0,
          }}
        >
          Willkommen zurück
        </h1>
        <p style={{ fontSize: 14, color: '#909090', marginBottom: 28, marginTop: 0 }}>
          Melden Sie sich in Ihrem Konto an
        </p>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="name@agentur.de"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Passwort</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Wird angemeldet…' : 'Anmelden'}
          </button>
        </form>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            margin: '24px 0',
          }}
        >
          <div style={{ flex: 1, height: 1, background: '#E4E3DF' }} />
          <span style={{ fontSize: 12, color: '#b0b0b0', fontWeight: 500 }}>oder</span>
          <div style={{ flex: 1, height: 1, background: '#E4E3DF' }} />
        </div>

        {/* Magic Link */}
        {magicError && <div style={errorBoxStyle}>{magicError}</div>}
        {magicSent && (
          <div
            style={{
              background: '#F0FFF4',
              border: '1px solid #BBF7D0',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 13,
              color: '#16a34a',
              marginBottom: 16,
            }}
          >
            Magic Link wurde gesendet. Prüfen Sie Ihr Postfach.
          </div>
        )}
        <form onSubmit={handleMagicLink}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>E-Mail für Magic Link</label>
            <input
              type="email"
              required
              value={magicEmail}
              onChange={e => setMagicEmail(e.target.value)}
              placeholder="name@agentur.de"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <button
            type="submit"
            disabled={magicLoading}
            style={{
              ...primaryButtonStyle,
              background: '#fff',
              color: '#0A0A0A',
              border: '1.5px solid #E4E3DF',
              opacity: magicLoading ? 0.6 : 1,
            }}
          >
            {magicLoading ? 'Wird gesendet…' : 'Magic Link senden'}
          </button>
        </form>
      </div>

      {/* Below card */}
      <p style={{ marginTop: 20, fontSize: 13, color: '#909090' }}>
        Noch kein Konto?{' '}
        <Link
          href="/app/a/register"
          style={{ color: '#909090', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Agentur registrieren →
        </Link>
      </p>
    </div>
  );
}
