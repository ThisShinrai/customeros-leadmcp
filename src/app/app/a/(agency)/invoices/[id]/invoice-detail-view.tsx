'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, FileText, Send, CheckCircle2, Trash2, EyeOff, Pencil } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import { InvoiceDocument } from '@/components/invoices/invoice-document';
import { EditInvoiceDrawer } from './edit-invoice-drawer';
import { releaseInvoice, setInvoiceStatus, deleteInvoice, regenerateInvoicePdf } from '../actions';
import type { InvoiceDetail } from '@/lib/invoices/format';
import type { InvoiceFormData } from '../queries';

interface Props {
  detail: InvoiceDetail;
  formData: InvoiceFormData;
  canRelease: boolean;
  canDelete: boolean;
  canCreate: boolean;
}

export function InvoiceDetailView({ detail, formData, canRelease, canDelete, canCreate }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, err: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); router.refresh(); }
    catch { toast.error(err); }
    finally { setBusy(null); }
  };

  async function openPdf() {
    if (detail.hasPdf) { window.open(`/api/invoices/${detail.id}/pdf`, '_blank'); return; }
    if (!canCreate) { toast.error('Kein PDF vorhanden.'); return; }
    setBusy('pdf');
    try {
      await regenerateInvoicePdf(detail.id);
      window.open(`/api/invoices/${detail.id}/pdf`, '_blank');
      router.refresh();
    } catch { toast.error('PDF konnte nicht erzeugt werden (keine Positionen?).'); }
    finally { setBusy(null); }
  }

  async function handleDelete() {
    setDeleting(true);
    try { await deleteInvoice(detail.id); toast.success('Rechnung gelöscht.'); router.push('/app/a/invoices'); }
    catch { toast.error('Löschen fehlgeschlagen.'); setDeleting(false); }
  }

  const subtitle = `${detail.invoiceNumber || 'Entwurf'} · ${detail.client.company || detail.client.name}`;

  return (
    <>
      <Topbar
        title={detail.title}
        subtitle={subtitle}
        actions={
          <Button size="sm" variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => router.push('/app/a/invoices')}>
            <span className="cos-desktop-only">Zurück</span>
          </Button>
        }
      />

      <div style={{ padding: '20px 24px 56px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Action toolbar — never printed */}
        <div data-no-print style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {!detail.visibleToClient && canRelease && (
            <Button size="sm" icon={<Send size={14} />} loading={busy === 'release'}
              onClick={() => run('release', () => releaseInvoice(detail.id), 'Für Kunden freigegeben.', 'Freigabe fehlgeschlagen.')}>
              Für Kunden freigeben
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => window.print()}>Drucken</Button>
          <Button size="sm" variant="secondary" icon={detail.hasPdf ? <Download size={14} /> : <FileText size={14} />} loading={busy === 'pdf'} onClick={openPdf}>
            {detail.hasPdf ? 'PDF herunterladen' : 'PDF erzeugen'}
          </Button>
          <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => window.open(`/api/invoices/${detail.id}/xml`, '_blank')}>
            E-Rechnung (XML)
          </Button>
          {canCreate && (
            <Button size="sm" variant="secondary" icon={<Pencil size={14} />} onClick={() => setEditOpen(true)}>Bearbeiten</Button>
          )}
          {detail.status !== 'paid' && canRelease && (
            <Button size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} loading={busy === 'paid'}
              onClick={() => run('paid', () => setInvoiceStatus(detail.id, 'paid'), 'Als bezahlt markiert.', 'Aktualisierung fehlgeschlagen.')}>
              Als bezahlt
            </Button>
          )}
          <span style={{ flex: 1 }} />
          {canDelete && (
            <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => setConfirmDel(true)}
              style={{ color: '#DC2626' }}>
              Löschen
            </Button>
          )}
        </div>

        {/* Visibility hint */}
        {!detail.visibleToClient && (
          <div data-no-print style={{
            display: 'flex', alignItems: 'center', gap: 9, alignSelf: 'center', maxWidth: 820, width: '100%',
            padding: '10px 14px', borderRadius: 12, background: 'var(--wash)', border: '1px solid var(--line)',
            fontSize: 12.5, color: 'var(--mid)', fontWeight: 500,
          }}>
            <EyeOff size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
            Entwurf — nur für dein Team sichtbar. Gib die Rechnung frei, damit dein Kunde sie im Portal sieht.
          </div>
        )}

        {/* The document */}
        <InvoiceDocument detail={detail} />
      </div>

      <EditInvoiceDrawer
        open={editOpen}
        onClose={() => setEditOpen(false)}
        detail={detail}
        formData={formData}
        onSaved={() => router.refresh()}
      />

      <ConfirmDialog
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={handleDelete}
        title="Rechnung löschen?"
        message={`„${detail.title}“ und alle Positionen werden dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`}
        confirmLabel="Endgültig löschen"
        danger
        loading={deleting}
      />
    </>
  );
}
