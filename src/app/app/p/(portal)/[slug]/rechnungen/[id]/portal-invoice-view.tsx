'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download, CreditCard, CheckCircle2, Copy, Landmark } from 'lucide-react';
import { PortalHeader } from '@/components/portal/portal-header';
import { InvoiceDocument } from '@/components/invoices/invoice-document';
import { Modal, Button, useToast } from '@/components/ui';
import { fmtEuro, fmtDate, fmtIban, type InvoiceDetail } from '@/lib/invoices/format';
import { payInvoice } from './payment-actions';

interface Props {
  detail: InvoiceDetail;
  slug: string;
  clientName: string;
  avatarUrl: string | null;
  avatarFrameColor: string | null;
  paymentEnabled: boolean;
}

const PAY_ERRORS: Record<string, string> = {
  ALREADY_PAID: 'Diese Rechnung ist bereits bezahlt.',
  NOT_AVAILABLE: 'Diese Rechnung ist nicht zur Zahlung freigegeben.',
  INVALID_AMOUNT: 'Ungültiger Rechnungsbetrag.',
  STRIPE_OFF: 'Online-Zahlung ist derzeit nicht verfügbar.',
  NOT_FOUND: 'Rechnung nicht gefunden.',
  NO_URL: 'Zahlung konnte nicht gestartet werden.',
};

export function PortalInvoiceView({ detail, slug, clientName, avatarUrl, avatarFrameColor, paymentEnabled }: Props) {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [justPaid, setJustPaid] = useState(false);

  // Read the ?bezahlt=1 return flag without useSearchParams (no Suspense needed).
  useEffect(() => {
    setJustPaid(new URLSearchParams(window.location.search).get('bezahlt') === '1');
  }, []);

  const hasBank = !!detail.agency.iban;
  const canPay = (paymentEnabled || hasBank) && detail.status !== 'paid' && detail.totalAmount > 0;
  const pdfPrimary = !canPay;
  const reference = detail.invoiceNumber || detail.title;

  async function payOnline() {
    setPaying(true);
    try {
      const res = await payInvoice(detail.id);
      if ('url' in res) { window.location.href = res.url; return; }
      toast.error(PAY_ERRORS[res.error] ?? 'Zahlung fehlgeschlagen.');
      setPaying(false);
    } catch {
      toast.error('Zahlung fehlgeschlagen. Bitte erneut versuchen.');
      setPaying(false);
    }
  }

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert.`);
    } catch { toast.error('Kopieren nicht möglich.'); }
  }

  return (
    <div className="page-transition">
      <PortalHeader
        title="Rechnung"
        subtitle={detail.invoiceNumber || detail.title}
        clientName={clientName}
        avatarUrl={avatarUrl}
        avatarFrameColor={avatarFrameColor}
      />

      <div style={{ padding: '20px 24px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* success banner after returning from Stripe Checkout */}
        {justPaid && (
          <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 16px', borderRadius: 14, background: '#DCFCE7', border: '1px solid #A7F3C0', color: '#15803D' }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>
              {detail.status === 'paid'
                ? 'Vielen Dank — Ihre Zahlung ist eingegangen.'
                : 'Zahlung erhalten — die Rechnung wird in Kürze als bezahlt markiert.'}
            </span>
          </div>
        )}

        {/* toolbar — never printed */}
        <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Link
            href={`/app/p/${slug}/rechnungen`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--mid)', textDecoration: 'none', padding: '8px 12px', borderRadius: 10 }}
          >
            <ArrowLeft size={15} /> Alle Rechnungen
          </Link>
          <span style={{ flex: 1 }} />
          <button
            onClick={() => window.print()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--ink)', background: '#fff', border: '1px solid var(--line)', borderRadius: 100, padding: '8px 15px', cursor: 'pointer' }}
          >
            <Printer size={14} /> Drucken
          </button>
          {detail.hasPdf && (
            <a
              href={`/api/invoices/${detail.id}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700,
                color: pdfPrimary ? '#fff' : 'var(--ink)',
                background: pdfPrimary ? 'var(--accent)' : '#fff',
                border: pdfPrimary ? 'none' : '1px solid var(--line)',
                borderRadius: 100, padding: '8px 16px', textDecoration: 'none',
              }}
            >
              <Download size={14} /> PDF{pdfPrimary ? ' herunterladen' : ''}
            </a>
          )}
          {canPay && (
            <button
              onClick={() => setPayOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 100, padding: '8px 18px', cursor: 'pointer', boxShadow: '0 8px 22px rgba(var(--accent-rgb),.32)' }}
            >
              <CreditCard size={15} /> {fmtEuro(detail.totalAmount)} bezahlen
            </button>
          )}
        </div>

        <InvoiceDocument detail={detail} />
      </div>

      {/* payment modal — bank transfer details + optional online checkout */}
      <Modal open={payOpen} onClose={() => !paying && setPayOpen(false)} title="Rechnung bezahlen" subtitle={`${reference} · ${fmtEuro(detail.totalAmount)}`} width={480}
        footer={<Button variant="secondary" onClick={() => setPayOpen(false)} disabled={paying}>Schließen</Button>}>
        {hasBank && (
          <div style={{ borderRadius: 14, border: '1px solid var(--line)', padding: '16px 18px', marginBottom: paymentEnabled ? 16 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: 'var(--faint)', marginBottom: 12 }}>
              <Landmark size={13} /> Per Überweisung
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <BankRow label="Empfänger" value={detail.agency.name} />
              <BankRow label="IBAN" value={fmtIban(detail.agency.iban!)} onCopy={() => copy(detail.agency.iban!.replace(/\s+/g, ''), 'IBAN')} />
              {detail.agency.bic && <BankRow label="BIC" value={detail.agency.bic.toUpperCase()} />}
              <BankRow label="Betrag" value={fmtEuro(detail.totalAmount)} />
              <BankRow label="Verwendungszweck" value={reference} onCopy={() => copy(reference, 'Verwendungszweck')} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 12 }}>
              {detail.dueDate ? `Zahlbar bis ${fmtDate(detail.dueDate)} ohne Abzug.` : 'Zahlbar nach Erhalt ohne Abzug.'}
            </div>
          </div>
        )}

        {paymentEnabled && (
          <button
            onClick={payOnline}
            disabled={paying}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontSize: 14, fontWeight: 700, color: '#fff', background: 'var(--accent)', border: 'none', borderRadius: 14, padding: '13px 18px', cursor: paying ? 'default' : 'pointer', opacity: paying ? 0.7 : 1 }}
          >
            <CreditCard size={16} /> {paying ? 'Wird geöffnet…' : 'Online bezahlen (Karte u. a.)'}
          </button>
        )}
      </Modal>
    </div>
  );
}

function BankRow({ label, value, onCopy }: { label: string; value: string; onCopy?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, color: 'var(--faint)', width: 128, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--black)', flex: 1, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all' }}>{value}</span>
      {onCopy && (
        <button onClick={onCopy} title={`${label} kopieren`} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--line)', background: '#fff', color: 'var(--mid)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <Copy size={13} />
        </button>
      )}
    </div>
  );
}
