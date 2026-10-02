'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreVertical, Send, CheckCircle2, FileText, Trash2, Hourglass, AlertTriangle, Wallet, Receipt, RefreshCw, X, Eye, FileSpreadsheet, BellRing } from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import { usePrivacy } from '@/components/privacy/privacy-mode';
import { Drawer, Button, Field, Input, Select, DropdownMenu, ConfirmDialog, useToast, BentoCard } from '@/components/ui';
import { formatEUR, formatDate } from '@/lib/utils';
import { fmtDate } from '@/lib/invoices/format';
import { createInvoice, releaseInvoice, setInvoiceStatus, deleteInvoice, regenerateInvoicePdf } from './actions';
import { sendReminder } from './reminder-actions';
import type { InvoiceListItem, InvoiceStats, InvoiceFormData } from './queries';

const ease = 'cubic-bezier(.16,1,.3,1)';

type FilterKey = 'alle' | 'offen' | 'ueberfaellig' | 'bezahlt';
const FILTERS: { key: FilterKey; label: string; match: (i: InvoiceListItem) => boolean }[] = [
  { key: 'alle', label: 'Alle', match: () => true },
  { key: 'offen', label: 'Offen', match: (i) => i.status === 'sent' },
  { key: 'ueberfaellig', label: 'Überfällig', match: (i) => i.status === 'overdue' },
  { key: 'bezahlt', label: 'Bezahlt', match: (i) => i.status === 'paid' },
];

const STATUS_META: Record<InvoiceListItem['status'], { label: string; style: React.CSSProperties }> = {
  draft: { label: 'Entwurf', style: { background: '#F4F3F0', border: '1.5px solid transparent', color: '#909090' } },
  sent: { label: 'Offen', style: { background: 'transparent', border: '1.5px solid #0A0A0A', color: '#0A0A0A' } },
  paid: { label: 'Bezahlt', style: { background: '#F0FDF4', border: '1.5px solid transparent', color: '#16A34A' } },
  overdue: { label: 'Überfällig', style: { background: '#FEF2F2', border: '1.5px solid #ef4444', color: '#ef4444' } },
};

// Dunning — action label keyed by the NEXT level (current reminderLevel).
const NEXT_REMINDER_LABEL: Record<number, string> = {
  0: 'Zahlungserinnerung senden',
  1: '1. Mahnung senden',
  2: '2. Mahnung senden',
  3: 'Erneut mahnen',
};
// Name of a sent stage, keyed by the level returned from sendReminder.
const SENT_STAGE_LABEL: Record<number, string> = {
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
};
// Short badge label for an already-reached reminder level.
const REMINDER_BADGE_LABEL: Record<number, string> = {
  1: 'Zahlungserinnerung',
  2: '1. Mahnung',
  3: '2. Mahnung',
};

function StatusChip({ status }: { status: InvoiceListItem['status'] }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ ...meta.style, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {meta.label}
    </span>
  );
}

function StatCard({ label, cents, sub, icon, accent, danger }: {
  label: string; cents: number; sub?: string; icon: React.ReactNode; accent?: boolean; danger?: boolean;
}) {
  const numColor = danger ? '#DC2626' : accent ? 'var(--accent)' : '#0A0A0A';
  const iconBg = danger ? '#FEE2E2' : accent ? 'rgba(var(--accent-rgb),.12)' : '#F4F3F0';
  const iconColor = danger ? '#DC2626' : accent ? 'var(--accent)' : '#505050';
  return (
    <BentoCard padding={24} style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 146,
      background: danger ? '#FEF5F5' : accent ? 'rgba(var(--accent-rgb),.045)' : '#fff',
      borderColor: danger ? '#FECACA' : undefined,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color: danger ? '#DC2626' : '#909090', lineHeight: 1 }}>{label}</span>
        <span style={{ width: 38, height: 38, borderRadius: 11, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, color: numColor, fontVariantNumeric: 'tabular-nums' }}>{formatEUR(cents)}</div>
        {sub && <div style={{ fontSize: 12, color: danger ? '#DC2626' : '#909090', marginTop: 6, fontWeight: 500 }}>{sub}</div>}
      </div>
    </BentoCard>
  );
}

interface Props {
  invoices: InvoiceListItem[];
  stats: InvoiceStats;
  formData: InvoiceFormData;
  canCreate: boolean;
}

export function InvoicesView({ invoices, stats, formData, canCreate }: Props) {
  const { isHidden, hideStyle } = usePrivacy();
  const router = useRouter();
  const toast = useToast();
  const [filter, setFilter] = useState<FilterKey>('alle');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = invoices.filter(FILTERS.find((f) => f.key === filter)!.match);

  const openCount = invoices.filter((i) => i.status === 'sent').length;
  const overdueCount = invoices.filter((i) => i.status === 'overdue').length;
  const paidCount = invoices.filter((i) => i.status === 'paid').length;

  async function handleRelease(inv: InvoiceListItem) {
    try {
      await releaseInvoice(inv.id);
      toast.success('Rechnung für Kunden freigegeben.');
      router.refresh();
    } catch {
      toast.error('Freigabe fehlgeschlagen.');
    }
  }

  async function handleStatus(inv: InvoiceListItem, status: 'paid' | 'overdue') {
    try {
      await setInvoiceStatus(inv.id, status);
      toast.success(status === 'paid' ? 'Als bezahlt markiert.' : 'Als überfällig markiert.');
      router.refresh();
    } catch {
      toast.error('Aktualisierung fehlgeschlagen.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteInvoice(deleteTarget.id);
      toast.success('Rechnung gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleRegenerate(inv: InvoiceListItem) {
    try {
      await regenerateInvoicePdf(inv.id);
      toast.success('PDF neu generiert.');
      router.refresh();
    } catch {
      toast.error('Keine Positionen — PDF kann nicht generiert werden.');
    }
  }

  async function handleReminder(inv: InvoiceListItem) {
    try {
      const res = await sendReminder(inv.id);
      if (res.ok) {
        const stage = res.level ? SENT_STAGE_LABEL[res.level] ?? 'Erinnerung' : 'Erinnerung';
        toast.success(`${stage} gesendet.`);
        router.refresh();
      } else if (res.reason === 'PAID') {
        toast.error('Rechnung ist bereits bezahlt.');
      } else if (res.reason === 'NOT_RELEASED') {
        toast.error('Rechnung ist noch nicht für den Kunden freigegeben.');
      } else {
        toast.error('Mahnung konnte nicht gesendet werden.');
      }
    } catch {
      toast.error('Mahnung konnte nicht gesendet werden.');
    }
  }

  function menuItems(inv: InvoiceListItem) {
    const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
    items.push({ label: 'Öffnen', icon: <Eye size={14} />, onClick: () => router.push(`/app/a/invoices/${inv.id}`) });
    if (!inv.visibleToClient) {
      items.push({ label: 'Für Kunden freigeben', icon: <Send size={14} />, onClick: () => handleRelease(inv) });
    }
    if (inv.status !== 'paid') {
      items.push({ label: 'Als bezahlt markieren', icon: <CheckCircle2 size={14} />, onClick: () => handleStatus(inv, 'paid') });
    }
    if (inv.status === 'sent' || inv.status === 'overdue') {
      items.push({ label: NEXT_REMINDER_LABEL[inv.reminderLevel] ?? 'Erneut mahnen', icon: <BellRing size={14} />, onClick: () => handleReminder(inv) });
    }
    if (inv.pdfR2Key) {
      items.push({ label: 'PDF öffnen', icon: <FileText size={14} />, onClick: () => window.open(`/api/invoices/${inv.id}/pdf`, '_blank') });
    }
    if (inv.pdfGenerated) {
      items.push({ label: 'PDF neu generieren', icon: <RefreshCw size={14} />, onClick: () => handleRegenerate(inv) });
    }
    items.push({ label: 'Löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(inv) });
    return items;
  }

  return (
    <>
      <Topbar
        title="Rechnungen"
        subtitle={`${invoices.length} Rechnung${invoices.length === 1 ? '' : 'en'}`}
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Button size="sm" variant="secondary" icon={<FileSpreadsheet size={14} />} onClick={() => window.open('/api/datev', '_blank')} title="DATEV-Export (Buchungsstapel)"><span className="cos-desktop-only">DATEV-Export</span></Button>
            {canCreate && (
              <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => setModalOpen(true)} title="Neue Rechnung"><span className="cos-desktop-only">Neue Rechnung</span></Button>
            )}
          </div>
        }
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Stats Row */}
        <div className="inv-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <StatCard label="Offen" cents={stats.openCents} icon={<Hourglass size={18} />} sub={openCount === 1 ? '1 Rechnung offen' : `${openCount} Rechnungen offen`} accent />
          <StatCard label="Überfällig" cents={stats.overdueCents} icon={<AlertTriangle size={18} />} sub={overdueCount > 0 ? (overdueCount === 1 ? '1 Rechnung überfällig' : `${overdueCount} Rechnungen überfällig`) : 'alles im Zeitplan'} danger={overdueCount > 0} />
          <StatCard label="Bezahlt" cents={stats.paidCents} icon={<Wallet size={18} />} sub={paidCount === 1 ? '1 Rechnung bezahlt' : `${paidCount} Rechnungen bezahlt`} />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                borderRadius: 100,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                border: filter === f.key ? '1.5px solid #0A0A0A' : '1.5px solid #E4E3DF',
                background: filter === f.key ? '#0A0A0A' : '#fff',
                color: filter === f.key ? '#fff' : '#505050',
                cursor: 'pointer',
                transition: `all .14s ${ease}`,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Invoice List */}
        <BentoCard interactive={false} padding={0} style={{ overflow: 'hidden' }}>
          {/* Slim dark header strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 22px', background: '#0A0A0A', color: '#fff',
          }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Receipt size={15} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff' }}>Alle Rechnungen</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>
              {filtered.length} {filtered.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>

          {filtered.map((inv, idx) => (
            <div
              key={inv.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px 16px',
                padding: '15px 22px',
                borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                transition: 'background .12s',
                cursor: 'pointer',
                ...hideStyle(inv.clientId),
              }}
              onClick={() => { if (!isHidden(inv.clientId)) router.push(`/app/a/invoices/${inv.id}`); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAF9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Left: invoice info */}
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.title}</span>
                  <span style={{ fontSize: 12, color: '#C4C4C0' }}>·</span>
                  <span style={{ fontSize: 13, color: '#505050', fontWeight: 500, whiteSpace: 'nowrap' }}>{inv.clientName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#909090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inv.invoiceNumber && (
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600, color: '#505050', letterSpacing: '-.2px' }}>{inv.invoiceNumber}</span>
                  )}
                  {inv.invoiceNumber && <span style={{ color: '#D4D3CF' }}>·</span>}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.projectName}</span>
                  {inv.pdfGenerated && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),.1)', borderRadius: 6, padding: '1px 6px' }}>
                      <FileText size={9} /> PDF
                    </span>
                  )}
                  {inv.reminderLevel > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, color: '#909090', background: '#F4F3F0', borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                      <BellRing size={9} /> {REMINDER_BADGE_LABEL[inv.reminderLevel] ?? `${inv.reminderLevel}. Mahnung`}
                      {inv.lastReminderAt ? ` · ${fmtDate(inv.lastReminderAt)}` : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: due date */}
              <div className="inv-due" style={{ fontSize: 12, color: '#909090', minWidth: 150, textAlign: 'right', flexShrink: 0 }}>
                {inv.dueDate ? `fällig ${formatDate(inv.dueDate)}` : '—'}
              </div>

              {/* Right: amount + status + menu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{formatEUR(inv.totalAmount)}</span>
                <StatusChip status={inv.status} />
                <DropdownMenu
                  trigger={
                    <button
                      style={{
                        width: 32, height: 32, borderRadius: 9, border: '1px solid #E4E3DF', background: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', cursor: 'pointer',
                      }}
                    >
                      <MoreVertical size={15} />
                    </button>
                  }
                  items={menuItems(inv)}
                />
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#909090', fontSize: 14 }}>
              Keine Rechnungen gefunden.
            </div>
          )}
        </BentoCard>

        <style>{`
          @media (max-width: 820px) {
            .inv-stats { grid-template-columns: 1fr !important; }
          }
          @media (max-width: 600px) {
            .inv-due { display: none !important; }
          }
        `}</style>
      </div>

      {canCreate && (
        <CreateInvoiceModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          formData={formData}
          onCreated={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        danger
        title="Rechnung löschen?"
        message="Diese Rechnung und das zugehörige PDF werden unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
      />
    </>
  );
}

interface LineItem { id: string; description: string; quantity: string; unitPriceEuro: string; taxRate: string }

let _lid = 0;
function newItem(): LineItem {
  _lid += 1;
  return { id: `it-${_lid}`, description: '', quantity: '1', unitPriceEuro: '', taxRate: '19' };
}

function centsFromEuro(raw: string): number {
  const s = raw.trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  let n = s;
  const hasComma = n.includes(','); const hasDot = n.includes('.');
  if (hasComma && hasDot) { n = n.lastIndexOf(',') > n.lastIndexOf('.') ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, ''); }
  else if (hasComma) { n = n.replace(',', '.'); }
  const v = Number(n);
  return isFinite(v) ? Math.round(v * 100) : 0;
}

type Mode = 'positionen' | 'upload';

function CreateInvoiceModal({ open, onClose, formData, onCreated }: {
  open: boolean;
  onClose: () => void;
  formData: InvoiceFormData;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { blurred, allowed } = usePrivacy();
  const clientOptions = blurred ? formData.clients.filter((c) => allowed.has(c.id)) : formData.clients;
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('positionen');
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Zahlungsziel-Standard: 14 Tage ab heute (Feld leeren = kein Zahlungsziel).
  function defaultDueDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  function reset() {
    setMode('positionen'); setTitle(''); setClientId(''); setProjectId(''); setDueDate(defaultDueDate()); setNotes('');
    setItems([newItem()]); setAmount(''); setFile(null);
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function addItem() { setItems((prev) => [...prev, newItem()]); }
  function removeItem(id: string) { setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev)); }

  // Live totals (positionen mode).
  let net = 0, tax = 0;
  for (const it of items) {
    const lineNet = Math.round(Number(it.quantity || '0') * centsFromEuro(it.unitPriceEuro));
    net += lineNet;
    tax += Math.round((lineNet * Number(it.taxRate || '0')) / 100);
  }
  const gross = net + tax;

  async function submit() {
    if (!title.trim()) { toast.error('Bitte geben Sie einen Titel ein.'); return; }
    if (!clientId) { toast.error('Bitte wählen Sie einen Kunden.'); return; }
    if (!projectId) { toast.error('Bitte wählen Sie ein Projekt.'); return; }

    if (mode === 'positionen') {
      const valid = items.filter((it) => it.description.trim() && centsFromEuro(it.unitPriceEuro) > 0);
      if (valid.length === 0) { toast.error('Bitte fügen Sie mindestens eine Position mit Preis hinzu.'); return; }
    } else if (!amount.trim()) {
      toast.error('Bitte geben Sie einen Betrag ein.'); return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set('title', title);
      fd.set('clientId', clientId);
      fd.set('projectId', projectId);
      if (dueDate) fd.set('dueDate', dueDate);
      if (notes.trim()) fd.set('notes', notes);

      if (mode === 'positionen') {
        const payload = items
          .filter((it) => it.description.trim() && centsFromEuro(it.unitPriceEuro) > 0)
          .map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity || '1'), unitPriceEuro: it.unitPriceEuro, taxRate: Number(it.taxRate || '0') }));
        fd.set('items', JSON.stringify(payload));
      } else {
        fd.set('amountEuro', amount);
        if (file) fd.set('pdf', file);
      }

      await createInvoice(fd);
      toast.success(mode === 'positionen' ? 'Rechnung erstellt & PDF generiert.' : 'Rechnung erstellt.');
      reset();
      onClose();
      onCreated();
    } catch {
      toast.error('Rechnung konnte nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={() => { if (!loading) { reset(); onClose(); } }}
      title="Neue Rechnung"
      subtitle="Positionen erfassen — das PDF wird automatisch generiert."
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={() => { reset(); onClose(); }} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>{mode === 'positionen' ? 'Erstellen & PDF generieren' : 'Rechnung erstellen'}</Button>
        </>
      }
    >
      {/* Mode switch */}
      <div style={{ display: 'flex', gap: 6, padding: 4, background: 'var(--wash)', borderRadius: 12, marginBottom: 18 }}>
        {([['positionen', 'Positionen + PDF'], ['upload', 'Eigenes PDF']] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: mode === m ? '#0A0A0A' : 'transparent',
              color: mode === m ? '#fff' : '#505050',
              transition: `all .16s ${ease}`,
            }}
          >{label}</button>
        ))}
      </div>

      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Website Relaunch Phase 2" autoFocus />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Kunde">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Kunde wählen…</option>
            {clientOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Projekt">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Projekt wählen…</option>
            {formData.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Zahlungsziel (Standard: 14 Tage)">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        <div style={{ fontSize: 11, color: '#909090', marginTop: 5 }}>Feld leeren, wenn kein Zahlungsziel auf der Rechnung stehen soll.</div>
      </Field>

      {mode === 'positionen' ? (
        <>
          <div style={{ marginTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090' }}>Positionen</span>
              <button onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                <Plus size={13} strokeWidth={2.5} /> Position
              </button>
            </div>

            {/* column hints */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 60px 28px', gap: 8, padding: '0 2px 6px', fontSize: 10, fontWeight: 600, color: '#B0AFAB', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              <span>Beschreibung</span><span style={{ textAlign: 'center' }}>Mng.</span><span style={{ textAlign: 'right' }}>Einzel €</span><span style={{ textAlign: 'center' }}>MwSt</span><span />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((it) => (
                <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 60px 28px', gap: 8, alignItems: 'center' }}>
                  <input className="cos-input" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Leistung" style={{ padding: '9px 11px', fontSize: 13 }} />
                  <input className="cos-input" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }} />
                  <input className="cos-input" value={it.unitPriceEuro} onChange={(e) => updateItem(it.id, { unitPriceEuro: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ padding: '9px 10px', fontSize: 13, textAlign: 'right' }} />
                  <div style={{ position: 'relative' }}>
                    <input className="cos-input" value={it.taxRate} onChange={(e) => updateItem(it.id, { taxRate: e.target.value.replace(/[^\d]/g, '').slice(0, 2) })} inputMode="numeric" style={{ padding: '9px 16px 9px 8px', fontSize: 13, textAlign: 'center' }} />
                    <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#B0AFAB', pointerEvents: 'none' }}>%</span>
                  </div>
                  <button onClick={() => removeItem(it.id)} disabled={items.length === 1} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: items.length === 1 ? '#D4D3CF' : '#909090', background: 'transparent' }} aria-label="Position entfernen">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Live totals */}
          <div style={{ marginTop: 14, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
            <Row label="Zwischensumme" value={formatEUR(net)} muted />
            <Row label="MwSt." value={formatEUR(tax)} muted />
            <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>Gesamtbetrag</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatEUR(gross)}</span>
            </div>
          </div>

          <Field label="Anmerkungen" hint="Optional. Erscheint unten auf dem PDF.">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="cos-input" rows={2} placeholder="z.B. Zahlbar innerhalb von 14 Tagen ohne Abzug." style={{ resize: 'vertical', lineHeight: 1.5 }} />
          </Field>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            <Field label="Betrag (€)">
              <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="2.400,00" inputMode="decimal" />
            </Field>
          </div>
          <Field label="PDF-Upload" hint="Optional. Wird privat in R2 gespeichert.">
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="cos-input"
              style={{ cursor: 'pointer', padding: '8px 12px' }}
            />
          </Field>
        </>
      )}

      {formData.clients.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--faint)', background: 'var(--wash)', padding: '12px 14px', borderRadius: 12, marginTop: 8 }}>
          Noch keine Kunden angelegt. Bitte laden Sie zuerst unter <strong>Kunden</strong> jemanden ein.
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '2px 0' }}>
      <span style={{ fontSize: 12, color: muted ? 'rgba(255,255,255,.55)' : '#fff', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: muted ? 'rgba(255,255,255,.8)' : '#fff', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}
