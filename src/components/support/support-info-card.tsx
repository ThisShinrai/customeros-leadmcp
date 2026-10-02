'use client';

import React, { useEffect, useState } from 'react';
import { Headset, Copy, Check, Eye, EyeOff, MessageSquarePlus } from 'lucide-react';

interface Props {
  customerNumber: string;
  /** null for non-owner team members — the PIN is owner-only. */
  supportPin: string | null;
}

/**
 * Owner-facing support panel: customer number + support PIN (blurred, revealable)
 * and a contact button. On mobile the credentials only show during support hours
 * (10–19); on desktop they're always available.
 */
export function SupportInfoCard({ customerNumber, supportPin }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [withinHours, setWithinHours] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const upd = () => {
      const h = new Date().getHours();
      setWithinHours(h >= 10 && h < 19);
      setIsMobile(window.matchMedia('(max-width: 860px)').matches);
    };
    upd();
    const id = window.setInterval(upd, 60_000);
    window.addEventListener('resize', upd);
    return () => { window.clearInterval(id); window.removeEventListener('resize', upd); };
  }, []);

  function copy(text: string, key: string) {
    navigator.clipboard?.writeText(text)
      .then(() => { setCopied(key); setTimeout(() => setCopied(null), 1400); })
      .catch(() => {});
  }

  const showDetails = !isMobile || withinHours;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--black)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Headset size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--black)', letterSpacing: '-0.3px' }}>epssys Support</div>
          <div style={{ fontSize: 12, color: 'var(--faint)' }}>Bei Fragen oder Problemen — wir helfen.</div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: withinHours ? '#0a7d3a' : 'var(--faint)', background: withinHours ? 'rgba(22,163,74,.1)' : 'var(--wash)', padding: '5px 10px', borderRadius: 100, flexShrink: 0, whiteSpace: 'nowrap' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: withinHours ? '#16a34a' : '#bbb' }} />
          {withinHours ? 'Jetzt erreichbar' : 'Mo–Fr 10–19 Uhr'}
        </span>
      </div>

      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {showDetails ? (
          <>
            <CredRow label="Kundennummer" value={customerNumber} onCopy={() => copy(customerNumber, 'cn')} copied={copied === 'cn'} />
            {supportPin && (
              <div>
                <CredRow
                  label="Support-PIN"
                  value={supportPin}
                  blurred={!revealed}
                  revealed={revealed}
                  onReveal={() => setRevealed((v) => !v)}
                  onCopy={() => copy(supportPin, 'pin')}
                  copied={copied === 'pin'}
                />
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 7, lineHeight: 1.45 }}>
                  Gib Kundennr. + PIN nur an den epssys-Support. Damit autorisierst du eine
                  Einsicht — <strong>ohne</strong> Zugriff auf deine Projekte, Dateien oder Chats.
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--mid)', lineHeight: 1.5, padding: '4px 0' }}>
            Kundennr. &amp; Support-PIN sind während der Support-Zeiten <strong>(Mo–Fr 10–19 Uhr)</strong> hier sichtbar.
          </div>
        )}

        <button
          onClick={() => window.dispatchEvent(new Event('cos:open-support'))}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%',
            padding: 12, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'var(--black)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
            transition: 'filter .14s, transform .12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.18)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
        >
          <MessageSquarePlus size={16} /> Support kontaktieren
        </button>
      </div>
    </div>
  );
}

function CredRow({
  label, value, blurred, revealed, onReveal, onCopy, copied,
}: {
  label: string;
  value: string;
  blurred?: boolean;
  revealed?: boolean;
  onReveal?: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--faint)', marginBottom: 3 }}>{label}</div>
        <div style={{
          fontSize: 17, fontWeight: 700, color: 'var(--black)',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace', letterSpacing: '.04em',
          filter: blurred ? 'blur(7px)' : 'none', userSelect: blurred ? 'none' : 'auto',
          transition: 'filter .2s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>
      </div>
      {onReveal && (
        <IconBtn onClick={onReveal} label={revealed ? 'PIN verbergen' : 'PIN aufdecken'}>
          {revealed ? <EyeOff size={15} /> : <Eye size={15} />}
        </IconBtn>
      )}
      <IconBtn onClick={onCopy} label="Kopieren">
        {copied ? <Check size={15} color="#16a34a" /> : <Copy size={15} />}
      </IconBtn>
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        border: '1px solid var(--line)', background: '#fff', color: 'var(--mid)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'background .14s, color .14s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--black)'; e.currentTarget.style.color = '#fff'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = 'var(--mid)'; }}
    >
      {children}
    </button>
  );
}
