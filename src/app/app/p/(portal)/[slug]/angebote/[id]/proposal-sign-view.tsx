'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, FileSignature, Printer } from 'lucide-react';
import { PortalHeader } from '@/components/portal/portal-header';
import { Modal, ConfirmDialog, Button, Field, Input, useToast } from '@/components/ui';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import type { ClientProposalDetail } from '../../proposal-actions';
import { signProposal, declineProposal } from '../../proposal-actions';

interface Props {
  slug: string;
  detail: ClientProposalDetail;
  clientName: string;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
  agencyName: string;
  agencyLogo: string | null;
}

const STATUS_META: Record<ClientProposalDetail['proposal']['status'], { label: string; fg: string; bg: string; border: string }> = {
  draft: { label: 'Entwurf', fg: '#52525B', bg: '#F1F1EF', border: '#E4E3DF' },
  sent: { label: 'Gesendet', fg: '#B45309', bg: '#FEF3C7', border: '#FDE38A' },
  viewed: { label: 'Angesehen', fg: '#1D4ED8', bg: '#DBEAFE', border: '#BFDBFE' },
  signed: { label: 'Unterschrieben', fg: '#15803D', bg: '#DCFCE7', border: '#A7F3C0' },
  declined: { label: 'Abgelehnt', fg: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
};

export function ProposalSignView({ slug, detail, clientName, avatarUrl, avatarFrameColor, agencyName, agencyLogo }: Props) {
  const router = useRouter();
  const { success, error } = useToast();
  const { proposal, items, totals } = detail;

  const [signOpen, setSignOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [name, setName] = useState(clientName || '');
  const [consent, setConsent] = useState(false);
  const [signing, setSigning] = useState(false);
  const [declining, setDeclining] = useState(false);

  const sm = STATUS_META[proposal.status] ?? STATUS_META.sent;
  const accent = 'var(--accent)';
  const monogram = (agencyName.trim()[0] || 'A').toUpperCase();
  const canAct = proposal.status === 'sent' || proposal.status === 'viewed';

  async function handleSign() {
    const trimmed = name.trim();
    if (!trimmed) { error('Bitte geben Sie Ihren Namen ein.'); return; }
    if (!consent) { error('Bitte bestätigen Sie die Annahme.'); return; }
    setSigning(true);
    try {
      await signProposal(proposal.id, trimmed);
      success('Angebot angenommen. Vielen Dank!');
      setSignOpen(false);
      setConsent(false);
      router.refresh();
    } catch {
      error('Das Angebot konnte nicht angenommen werden.');
    } finally {
      setSigning(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    try {
      await declineProposal(proposal.id);
      success('Angebot abgelehnt.');
      setDeclineOpen(false);
      router.refresh();
    } catch {
      error('Das Angebot konnte nicht abgelehnt werden.');
    } finally {
      setDeclining(false);
    }
  }

  return (
    <div className="page-transition">
      <PortalHeader
        title="Angebot"
        subtitle={proposal.number || proposal.title}
        clientName={clientName}
        avatarUrl={avatarUrl}
        avatarFrameColor={avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* toolbar — never printed */}
        <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={`/app/p/${slug}/angebote`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--mid)', textDecoration: 'none', padding: '8px 12px', borderRadius: 10 }}
          >
            <ArrowLeft size={15} /> Alle Angebote
          </Link>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: '#fff', border: '1px solid var(--line)', borderRadius: 100, padding: '8px 15px', cursor: 'pointer' }}
          >
            <Printer size={14} /> Drucken
          </button>
        </div>

        {/* status banners (signed / declined) */}
        {proposal.status === 'signed' && (
          <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 16, background: '#F0FDF4', border: '1px solid #A7F3C0', maxWidth: 820, margin: '0 auto', width: '100%' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: '#DCFCE7', color: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={20} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#15803D', letterSpacing: '-0.3px' }}>
                ✓ Angenommen am {fmtDate(proposal.signedAt)}{proposal.signerName ? ` von ${proposal.signerName}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#16A34A', marginTop: 2 }}>Dieses Angebot wurde verbindlich angenommen.</div>
            </div>
          </div>
        )}
        {proposal.status === 'declined' && (
          <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderRadius: 16, background: '#FEF2F2', border: '1px solid #FECACA', maxWidth: 820, margin: '0 auto', width: '100%' }}>
            <span style={{ width: 38, height: 38, borderRadius: 10, background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <XCircle size={20} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#DC2626', letterSpacing: '-0.3px' }}>
                Abgelehnt{proposal.declinedAt ? ` am ${fmtDate(proposal.declinedAt)}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: '#DC2626', marginTop: 2 }}>Sie haben dieses Angebot abgelehnt.</div>
            </div>
          </div>
        )}

        {/* ── The proposal document (paper) ── */}
        <article
          className="inv-paper"
          style={{
            width: '100%', maxWidth: 820, margin: '0 auto', background: '#fff',
            color: 'var(--ink)', borderRadius: 18, border: '1px solid var(--line)',
            boxShadow: '0 30px 80px rgba(10,10,10,.10), 0 6px 18px rgba(10,10,10,.05)',
            overflow: 'hidden', fontVariantNumeric: 'tabular-nums',
          }}
        >
          <div className="inv-cap" style={{ height: 6, background: accent }} />

          <div className="inv-pad" style={{ padding: '44px 48px 40px' }}>
            {/* Header: brand left, proposal marker right */}
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
                {agencyLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={agencyLogo} alt={agencyName} style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800, flexShrink: 0 }}>
                    {monogram}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--black)' }}>{agencyName}</div>
                </div>
              </div>

              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: accent, textTransform: 'uppercase' }}>Angebot</div>
                <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--black)', marginTop: 2 }}>
                  {proposal.number || '—'}
                </div>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', marginTop: 9, padding: '4px 11px', borderRadius: 100,
                  fontSize: 12, fontWeight: 700, color: sm.fg, background: sm.bg, border: `1px solid ${sm.border}`,
                }}>{sm.label}</span>
              </div>
            </header>

            {/* Meta */}
            <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, marginTop: 36 }} className="inv-meta">
              <div>
                <Label>Angebot für</Label>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--black)', marginTop: 8 }}>{clientName}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <MetaRow k="Datum" v={fmtDate(proposal.createdAt)} />
                <MetaRow k="Gültig bis" v={fmtDate(proposal.validUntil)} />
              </div>
            </section>

            {/* Subject */}
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.6px', color: 'var(--black)', margin: '34px 0 0', lineHeight: 1.2 }}>
              {proposal.title}
            </h1>

            {/* Intro */}
            {proposal.intro && (
              <p style={{ fontSize: 13.5, color: 'var(--mid)', lineHeight: 1.65, margin: '12px 0 0', whiteSpace: 'pre-wrap', maxWidth: 640 }}>
                {proposal.intro}
              </p>
            )}

            {/* Items */}
            {items.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 22, fontSize: 13.5 }} className="inv-table">
                <thead>
                  <tr>
                    <Th align="left">Beschreibung</Th>
                    <Th align="right" w={56}>Menge</Th>
                    <Th align="right" w={104}>Einzelpreis</Th>
                    <Th align="right" w={56}>Steuer</Th>
                    <Th align="right" w={112}>Summe</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--line)' }}>
                      <td style={{ padding: '12px 12px 12px 0', verticalAlign: 'top' }}>
                        <span style={{ fontWeight: 600, color: 'var(--black)' }}>{it.description}</span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--mid)', verticalAlign: 'top' }}>{it.quantity}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--mid)', verticalAlign: 'top' }}>{fmtEuro(it.unitPriceCents)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: 'var(--faint)', verticalAlign: 'top' }}>{it.taxRate}%</td>
                      <td style={{ padding: '12px 0 12px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--black)', verticalAlign: 'top' }}>{fmtEuro(it.quantity * it.unitPriceCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: items.length > 0 ? 22 : 26 }}>
              <div style={{ width: 'min(340px, 100%)' }}>
                {items.length > 0 && (
                  <>
                    <TotalRow k="Netto" v={fmtEuro(totals.netCents)} />
                    {totals.taxByRate.map((t) => (
                      <TotalRow key={t.rate} k={`zzgl. ${t.rate}% USt.`} v={fmtEuro(t.taxCents)} muted />
                    ))}
                  </>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
                  marginTop: items.length > 0 ? 12 : 0, paddingTop: items.length > 0 ? 14 : 0,
                  borderTop: items.length > 0 ? '2px solid var(--black)' : 'none',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Gesamt</span>
                  <span style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.6px', color: accent }}>{fmtEuro(items.length > 0 ? totals.grossCents : proposal.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Signature footer inside paper (printed) */}
            {proposal.status === 'signed' && (
              <div style={{ marginTop: 34, paddingTop: 18, borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={18} style={{ color: '#16A34A', flexShrink: 0 }} />
                <div style={{ fontSize: 12.5, color: 'var(--mid)', lineHeight: 1.5 }}>
                  Verbindlich angenommen{proposal.signerName ? ` von ${proposal.signerName}` : ''} am {fmtDate(proposal.signedAt)}.
                </div>
              </div>
            )}

            <footer style={{ marginTop: proposal.status === 'signed' ? 20 : 34, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 11.5, color: 'var(--mid)', fontWeight: 600, alignSelf: 'flex-end' }}>Wir freuen uns auf die Zusammenarbeit.</div>
            </footer>
          </div>
        </article>

        {/* ── Action bar (only when actionable) ── */}
        {canAct && (
          <div data-no-print style={{ maxWidth: 820, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setDeclineOpen(true)} icon={<XCircle size={15} />}>Ablehnen</Button>
            <Button variant="primary" onClick={() => setSignOpen(true)} icon={<FileSignature size={15} />}>Annehmen &amp; Unterschreiben</Button>
          </div>
        )}
      </div>

      {/* ── Sign modal ── */}
      <Modal
        open={signOpen}
        onClose={() => !signing && setSignOpen(false)}
        title="Angebot annehmen"
        subtitle="Bestätigen Sie die verbindliche Annahme mit Ihrem Namen."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSignOpen(false)} disabled={signing}>Abbrechen</Button>
            <Button variant="primary" loading={signing} onClick={handleSign} icon={<FileSignature size={15} />}>Verbindlich annehmen</Button>
          </>
        }
      >
        <Field label="Ihr Name" hint="Ihr Name gilt als elektronische Unterschrift.">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vor- und Nachname"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && consent) handleSign(); }}
          />
        </Field>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: 'var(--wash)', border: `1.5px solid ${consent ? 'var(--accent)' : 'var(--line)'}`, transition: 'border-color .14s' }}>
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
          />
          <span style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5, fontWeight: 500 }}>
            Ich nehme dieses Angebot verbindlich an.
          </span>
        </label>
      </Modal>

      {/* ── Decline confirm ── */}
      <ConfirmDialog
        open={declineOpen}
        onClose={() => !declining && setDeclineOpen(false)}
        onConfirm={handleDecline}
        title="Angebot ablehnen?"
        message="Möchten Sie dieses Angebot wirklich ablehnen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Ablehnen"
        danger
        loading={declining}
      />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{children}</span>;
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13 }}>
      <span style={{ color: 'var(--faint)' }}>{k}</span>
      <span style={{ fontWeight: 600, color: 'var(--black)', textAlign: 'right' }}>{v}</span>
    </div>
  );
}

function TotalRow({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '5px 0', fontSize: 13.5 }}>
      <span style={{ color: muted ? 'var(--faint)' : 'var(--mid)' }}>{k}</span>
      <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{v}</span>
    </div>
  );
}

function Th({ children, align, w }: { children?: React.ReactNode; align: 'left' | 'right'; w?: number }) {
  return (
    <th style={{
      textAlign: align, padding: '0 8px 9px 0', width: w, whiteSpace: 'nowrap',
      fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--faint)',
    }}>{children}</th>
  );
}
