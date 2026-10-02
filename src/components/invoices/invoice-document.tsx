import React from 'react';
import { fmtEuro, fmtDate, fmtIban, statusMeta, type InvoiceDetail } from '@/lib/invoices/format';

/**
 * The on-screen invoice document — a premium "paper" surface that prints clean.
 * Presentational only (no hooks), used by both the agency preview and the client
 * portal. Print rules live in globals.css under `.inv-paper` / `@media print`.
 */
export function InvoiceDocument({ detail }: { detail: InvoiceDetail }) {
  const { agency, client, items, totals } = detail;
  const accent = agency.accentColor || '#0A0A0A';
  const sm = statusMeta(detail.status);
  const monogram = (agency.name.trim()[0] || 'A').toUpperCase();

  const contactBits = [agency.address, agency.contactEmail, agency.phone, agency.website].filter(Boolean) as string[];

  return (
    <article
      className="inv-paper"
      style={{
        width: '100%', maxWidth: 820, margin: '0 auto', background: '#fff',
        color: 'var(--ink)', borderRadius: 18, border: '1px solid var(--line)',
        boxShadow: '0 30px 80px rgba(10,10,10,.10), 0 6px 18px rgba(10,10,10,.05)',
        overflow: 'hidden', fontVariantNumeric: 'tabular-nums',
      }}
    >
      {/* accent cap */}
      <div className="inv-cap" style={{ height: 6, background: accent }} />

      <div className="inv-pad" style={{ padding: '44px 48px 40px' }}>
        {/* ── Header: brand left, invoice marker right ── */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', minWidth: 0 }}>
            {agency.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agency.logo} alt={agency.name} style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: 12, background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 800, flexShrink: 0 }}>
                {monogram}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--black)' }}>{agency.name}</div>
              {contactBits.length > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 3, lineHeight: 1.5, maxWidth: 320 }}>
                  {contactBits.join(' · ')}
                </div>
              )}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.18em', color: accent, textTransform: 'uppercase' }}>Rechnung</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--black)', marginTop: 2 }}>
              {detail.invoiceNumber || '—'}
            </div>
            <span style={{
              display: 'inline-flex', alignItems: 'center', marginTop: 9, padding: '4px 11px', borderRadius: 100,
              fontSize: 12, fontWeight: 700, color: sm.fg, background: sm.bg, border: `1px solid ${sm.border}`,
            }}>{sm.label}</span>
          </div>
        </header>

        {/* ── Bill-to + meta ── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, marginTop: 36 }} className="inv-meta">
          <div>
            <Label>Rechnung an</Label>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--black)', marginTop: 8 }}>
              {client.company || client.name}
            </div>
            {client.company && <div style={{ fontSize: 13, color: 'var(--mid)', marginTop: 1 }}>{client.name}</div>}
            {client.email && <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 2 }}>{client.email}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <MetaRow k="Rechnungsdatum" v={fmtDate(detail.issueDate)} />
            <MetaRow k="Fällig am" v={fmtDate(detail.dueDate)} accent={detail.status === 'overdue' ? '#DC2626' : undefined} />
            <MetaRow k="Projekt" v={detail.projectName} />
          </div>
        </section>

        {/* ── Subject ── */}
        <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.6px', color: 'var(--black)', margin: '34px 0 0', lineHeight: 1.2 }}>
          {detail.title}
        </h1>

        {/* ── Items (positionen invoices) ── */}
        {items.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20, fontSize: 13.5 }} className="inv-table">
            <thead>
              <tr>
                <Th align="left">Beschreibung</Th>
                <Th align="right" w={56}>Menge</Th>
                <Th align="right" w={104}>Einzelpreis</Th>
                <Th align="right" w={56}>MwSt</Th>
                <Th align="right" w={112}>Gesamt</Th>
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

        {/* ── Totals ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: items.length > 0 ? 22 : 26 }}>
          <div style={{ width: 'min(340px, 100%)' }}>
            {items.length > 0 && (
              <>
                <TotalRow k="Zwischensumme (netto)" v={fmtEuro(totals.netCents)} />
                {totals.taxByRate.map((t) => (
                  <TotalRow key={t.rate} k={`zzgl. ${t.rate}% MwSt.`} v={fmtEuro(t.taxCents)} muted />
                ))}
              </>
            )}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16,
              marginTop: items.length > 0 ? 12 : 0, paddingTop: items.length > 0 ? 14 : 0,
              borderTop: items.length > 0 ? '2px solid var(--black)' : 'none',
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--black)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Gesamtbetrag</span>
              <span style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-0.6px', color: accent }}>{fmtEuro(items.length > 0 ? totals.grossCents : detail.totalAmount)}</span>
            </div>
            {items.length === 0 && detail.hasPdf && (
              <div style={{ fontSize: 11.5, color: 'var(--faint)', textAlign: 'right', marginTop: 8 }}>Detaillierte Aufstellung im PDF.</div>
            )}
          </div>
        </div>

        {/* ── Payment details (bank transfer) ── */}
        {agency.iban && detail.status !== 'paid' && (
          <div style={{ marginTop: 30, borderRadius: 14, background: 'var(--wash, #F7F6F2)', borderLeft: `3px solid ${accent}`, padding: '16px 20px' }}>
            <Label>Zahlung per Überweisung</Label>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 24, rowGap: 6, marginTop: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--faint)' }}>IBAN</span>
              <span style={{ fontWeight: 700, color: 'var(--black)', fontVariantNumeric: 'tabular-nums' }}>{fmtIban(agency.iban)}</span>
              {agency.bic && (<><span style={{ color: 'var(--faint)' }}>BIC</span><span style={{ fontWeight: 700, color: 'var(--black)' }}>{agency.bic.toUpperCase()}</span></>)}
              <span style={{ color: 'var(--faint)' }}>Verwendungszweck</span>
              <span style={{ fontWeight: 700, color: 'var(--black)' }}>{detail.invoiceNumber || detail.title}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--mid)', marginTop: 10 }}>
              {detail.dueDate ? `Zahlbar bis ${fmtDate(detail.dueDate)} ohne Abzug.` : 'Zahlbar nach Erhalt ohne Abzug.'}
            </div>
          </div>
        )}

        {/* ── Notes ── */}
        {detail.notes && (
          <div style={{ marginTop: 30, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
            <Label>Anmerkungen</Label>
            <p style={{ fontSize: 13, color: 'var(--mid)', lineHeight: 1.6, margin: '8px 0 0', whiteSpace: 'pre-wrap', maxWidth: 620 }}>{detail.notes}</p>
          </div>
        )}

        {/* ── Footer ── */}
        <footer style={{ marginTop: 34, paddingTop: 16, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.6 }}>
            {agency.taxId && <div>USt-IdNr.: {agency.taxId}</div>}
            {[agency.contactEmail, agency.website].filter(Boolean).length > 0 && (
              <div>{[agency.contactEmail, agency.website].filter(Boolean).join(' · ')}</div>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--mid)', fontWeight: 600, alignSelf: 'flex-end' }}>Vielen Dank für Ihr Vertrauen.</div>
        </footer>
      </div>
    </article>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>{children}</span>;
}

function MetaRow({ k, v, accent }: { k: string; v: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, fontSize: 13 }}>
      <span style={{ color: 'var(--faint)' }}>{k}</span>
      <span style={{ fontWeight: 600, color: accent || 'var(--black)', textAlign: 'right' }}>{v}</span>
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
