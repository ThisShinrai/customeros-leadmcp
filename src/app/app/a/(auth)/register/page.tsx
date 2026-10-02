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

export default function RegisterPage() {
  const router = useRouter();

  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    if (password.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    setLoading(true);
    const { error: err } = await authClient.signUp.email({
      email,
      password,
      name: agencyName,
    });
    if (err) {
      setError(err.message || 'Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      setLoading(false);
    } else {
      router.push('/app/a/dashboard');
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
          Agentur registrieren
        </h1>
        <p style={{ fontSize: 14, color: '#909090', marginBottom: 28, marginTop: 0 }}>
          Erstellen Sie Ihr epssys-Konto
        </p>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <form onSubmit={handleRegister}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Agenturname</label>
            <input
              type="text"
              required
              value={agencyName}
              onChange={e => setAgencyName(e.target.value)}
              placeholder="Muster Agentur GmbH"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>E-Mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="kontakt@agentur.de"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Passwort</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mindestens 8 Zeichen"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <div style={{ marginBottom: 28 }}>
            <label style={labelStyle}>Passwort bestätigen</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Passwort wiederholen"
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#0A0A0A')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E4E3DF')}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ ...primaryButtonStyle, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Konto wird erstellt…' : 'Konto erstellen'}
          </button>
        </form>
      </div>

      {/* Below card */}
      <p style={{ marginTop: 20, fontSize: 13, color: '#909090' }}>
        Bereits ein Konto?{' '}
        <Link
          href="/app/a/login"
          style={{ color: '#909090', textDecoration: 'underline', textUnderlineOffset: 3 }}
        >
          Anmelden →
        </Link>
      </p>
    </div>
  );
}
