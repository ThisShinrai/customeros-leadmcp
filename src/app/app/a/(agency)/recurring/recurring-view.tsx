'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, MoreVertical, Pencil, Trash2, X, Repeat, Play, Pause, Zap,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Drawer, Button, Field, Input, Select, Textarea, DropdownMenu, ConfirmDialog,
  useToast, BentoCard, EmptyState,
} from '@/components/ui';
import { fmtEuro, fmtDate } from '@/lib/invoices/format';
import { createRecurring, updateRecurring, setRecurringActive, deleteRecurring, runRecurringNow } from './actions';
import type { RecurringListItem } from './queries';
import type { InvoiceFormData } from '@/app/app/a/(agency)/invoices/queries';

const ease = 'cubic-bezier(.16,1,.3,1)';

type Interval = 1 | 3 | 12;
const INTERVAL_LABEL: Record<Interval, string> = { 1: 'monatlich', 3: 'quartalsweise', 12: 'jährlich' };
const INTERVAL_OPTIONS: { value: Interval; label: string }[] = [
  { value: 1, label: 'monatlich' },
  { value: 3, label: 'quartalsweise' },
  { value: 12, label: 'jährlich' },
];

function intervalLabel(months: number): string {
  return INTERVAL_LABEL[months as Interval] ?? `alle ${months} Monate`;
}

function ActiveChip({ active }: { active: boolean }) {
  const style: React.CSSProperties = active
    ? { background: '#F0FDF4', border: '1.5px solid transparent', color: '#16A34A' }
    : { background: '#F4F3F0', border: '1.5px solid transparent', color: '#909090' };
  return (
    <span style={{ ...style, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {active ? 'Aktiv' : 'Pausiert'}
    </span>
  );
}

interface Props {
  recurring: RecurringListItem[];
  clients: InvoiceFormData['clients'];
  projects: InvoiceFormData['projects'];
  canEdit: boolean;
}

export function RecurringView({ recurring, clients, projects, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<RecurringListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RecurringListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleRun(r: RecurringListItem) {
    try {
      const res = await runRecurringNow(r.id);
      if (res.ok) {
        toast.success('Rechnung erzeugt.');
        router.refresh();
      } else {
        toast.error('Rechnung konnte nicht erzeugt werden.');
      }
    } catch {
      toast.error('Rechnung konnte nicht erzeugt werden.');
    }
  }

  async function handleToggle(r: RecurringListItem) {
    try {
      await setRecurringActive(r.id, !r.active);
      toast.success(r.active ? 'Vorlage pausiert.' : 'Vorlage aktiviert.');
      router.refresh();
    } catch {
      toast.error('Aktualisierung fehlgeschlagen.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRecurring(deleteTarget.id);
      toast.success('Vorlage gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  function menuItems(r: RecurringListItem) {
    const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
    items.push({ label: 'Bearbeiten', icon: <Pencil size={14} />, onClick: () => setEditTarget(r) });
    items.push({ label: 'Jetzt erzeugen', icon: <Zap size={14} />, onClick: () => handleRun(r) });
    items.push(
      r.active
        ? { label: 'Pausieren', icon: <Pause size={14} />, onClick: () => handleToggle(r) }
        : { label: 'Aktivieren', icon: <Play size={14} />, onClick: () => handleToggle(r) },
    );
    items.push({ label: 'Löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(r) });
    return items;
  }

  return (
    <>
      <Topbar
        title="Wiederkehrende Rechnungen"
        subtitle="Retainer & Abos — automatisch erzeugt."
        actions={
          canEdit ? (
            <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)} title="Neue Vorlage">
              <span className="cos-desktop-only">Neue Vorlage</span>
            </Button>
          ) : undefined
        }
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <BentoCard interactive={false} padding={0} style={{ overflow: 'hidden' }}>
          {/* Slim dark header strip */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 22px', background: '#0A0A0A', color: '#fff',
          }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Repeat size={15} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff' }}>Alle Vorlagen</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>
              {recurring.length} {recurring.length === 1 ? 'Eintrag' : 'Einträge'}
            </span>
          </div>

          {recurring.map((r, idx) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px 16px',
                padding: '15px 22px',
                borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                transition: 'background .12s',
                cursor: canEdit ? 'pointer' : 'default',
              }}
              onClick={canEdit ? () => setEditTarget(r) : undefined}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#FAFAF9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {/* Left: template info */}
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                  <span style={{ fontSize: 12, color: '#C4C4C0' }}>·</span>
                  <span style={{ fontSize: 13, color: '#505050', fontWeight: 500, whiteSpace: 'nowrap' }}>{r.clientName}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#909090', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.projectName}</span>
                  <span style={{ color: '#D4D3CF' }}>·</span>
                  <span style={{ fontWeight: 600, color: '#505050' }}>{intervalLabel(r.intervalMonths)}</span>
                  {r.autoRelease && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: 'var(--accent)', background: 'rgba(var(--accent-rgb),.1)', borderRadius: 6, padding: '1px 6px' }}>
                      <Zap size={9} /> auto
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: next run */}
              <div className="rec-next" style={{ fontSize: 12, color: '#909090', minWidth: 150, textAlign: 'right', flexShrink: 0 }}>
                nächste: {fmtDate(r.nextRunAt)}
              </div>

              {/* Right: amount + status + menu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'flex-end', marginLeft: 'auto', flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(r.totalCents)}</span>
                <ActiveChip active={r.active} />
                {canEdit && (
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
                    items={menuItems(r)}
                  />
                )}
              </div>
            </div>
          ))}

          {recurring.length === 0 && (
            <EmptyState
              icon={<Repeat size={24} />}
              title="Noch keine Vorlagen"
              description="Erstellen Sie eine Vorlage für Retainer oder Abos — CustomerOS erzeugt die Rechnungen dann automatisch im gewählten Intervall."
              action={canEdit ? (
                <Button icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>Neue Vorlage</Button>
              ) : undefined}
            />
          )}
        </BentoCard>

        <style>{`
          @media (max-width: 600px) {
            .rec-next { display: none !important; }
          }
        `}</style>
      </div>

      {canEdit && (
        <RecurringDrawer
          open={createOpen}
          mode="create"
          clients={clients}
          projects={projects}
          onClose={() => setCreateOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {canEdit && editTarget && (
        <RecurringDrawer
          open={!!editTarget}
          mode="edit"
          recurringId={editTarget.id}
          initial={editTarget}
          clients={clients}
          projects={projects}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        danger
        title="Vorlage löschen?"
        message="Diese Vorlage wird unwiderruflich gelöscht. Bereits erzeugte Rechnungen bleiben erhalten."
        confirmLabel="Endgültig löschen"
      />
    </>
  );
}

/* ─────────────────────────── Create / Edit Drawer ─────────────────────────── */

interface LineItem { id: string; description: string; quantity: string; unitPriceEuro: string; taxRate: string }

let _lid = 0;
function newItem(): LineItem {
  _lid += 1;
  return { id: `it-${_lid}`, description: '', quantity: '1', unitPriceEuro: '', taxRate: '19' };
}

/** euro string → integer cents, per the actions' unitPriceCents contract. */
function centsFromEuro(euro: string): number {
  const v = parseFloat(euro.replace(/\./g, '').replace(',', '.'));
  return isFinite(v) ? Math.round(v * 100) : 0;
}

/** integer cents → editable euro string (1234 → "12,34"). */
function euroFromCents(cents: number): string {
  if (!cents) return '';
  const neg = cents < 0;
  const abs = Math.abs(cents);
  return `${neg ? '-' : ''}${Math.floor(abs / 100)},${(abs % 100).toString().padStart(2, '0')}`;
}

/** UTC ISO → "yyyy-mm-dd" for a date input (uses local calendar day). */
function dateInputValue(d: Date): string {
  const yy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

const TAX_OPTIONS = ['0', '7', '19'];

function RecurringDrawer({
  open, mode, recurringId, initial, clients, projects, onClose, onSaved,
}: {
  open: boolean;
  mode: 'create' | 'edit';
  recurringId?: string;
  initial?: RecurringListItem | null;
  clients: InvoiceFormData['clients'];
  projects: InvoiceFormData['projects'];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [notes, setNotes] = useState('');
  const [intervalMonths, setIntervalMonths] = useState<Interval>(1);
  const [nextRun, setNextRun] = useState('');
  const [autoRelease, setAutoRelease] = useState(false);
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  // Hydrate the edit form once from the row we already have.
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  if (mode === 'edit' && initial && hydratedFor !== initial.id) {
    setHydratedFor(initial.id);
    setTitle(initial.title);
    setClientId(initial.clientId);
    setProjectId(initial.projectId);
    setNotes(initial.notes ?? '');
    setIntervalMonths((initial.intervalMonths as Interval) ?? 1);
    setNextRun(dateInputValue(initial.nextRunAt));
    setAutoRelease(initial.autoRelease);
    setItems(
      initial.items.length
        ? initial.items.map((it) => {
            _lid += 1;
            return {
              id: `it-${_lid}`,
              description: it.description,
              quantity: String(it.quantity),
              unitPriceEuro: euroFromCents(it.unitPriceCents),
              taxRate: String(it.taxRate),
            };
          })
        : [newItem()],
    );
  }

  function reset() {
    setTitle(''); setClientId(''); setProjectId(''); setNotes('');
    setIntervalMonths(1); setNextRun(''); setAutoRelease(false);
    setItems([newItem()]); setHydratedFor(null);
  }

  function close() {
    if (loading) return;
    reset();
    onClose();
  }

  function updateItem(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function addItem() { setItems((prev) => [...prev, newItem()]); }
  function removeItem(id: string) { setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev)); }

  // Live totals.
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
    if (!nextRun) { toast.error('Bitte wählen Sie die nächste Ausführung.'); return; }
    const valid = items.filter((it) => it.description.trim() && centsFromEuro(it.unitPriceEuro) > 0);
    if (valid.length === 0) { toast.error('Bitte fügen Sie mindestens eine Position mit Preis hinzu.'); return; }

    setLoading(true);
    try {
      const input = {
        clientId,
        projectId,
        title: title.trim(),
        notes: notes.trim() || undefined,
        intervalMonths,
        nextRunAt: new Date(nextRun).toISOString(),
        autoRelease,
        items: valid.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity || '1'),
          unitPriceCents: centsFromEuro(it.unitPriceEuro),
          taxRate: Number(it.taxRate || '0'),
        })),
      };

      if (mode === 'edit' && recurringId) {
        await updateRecurring(recurringId, input);
        toast.success('Vorlage aktualisiert.');
      } else {
        await createRecurring(input);
        toast.success('Vorlage erstellt.');
      }
      reset();
      onSaved();
    } catch {
      toast.error(mode === 'edit' ? 'Vorlage konnte nicht aktualisiert werden.' : 'Vorlage konnte nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title={mode === 'edit' ? 'Vorlage bearbeiten' : 'Neue Vorlage'}
      subtitle="Retainer-Positionen erfassen — die Rechnung wird automatisch erzeugt."
      width={620}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>
            {mode === 'edit' ? 'Änderungen speichern' : 'Vorlage erstellen'}
          </Button>
        </>
      }
    >
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Wartung & Hosting — Retainer" autoFocus />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Kunde">
          <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Kunde wählen…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
        <Field label="Projekt">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">Projekt wählen…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Notiz" hint="Optional. Erscheint unten auf der erzeugten Rechnung.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="z.B. Monatlicher Wartungs- und Hosting-Retainer." style={{ lineHeight: 1.5 }} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Field label="Intervall">
          <Select value={String(intervalMonths)} onChange={(e) => setIntervalMonths(Number(e.target.value) as Interval)}>
            {INTERVAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Nächste Ausführung">
          <Input type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} />
        </Field>
      </div>

      {/* Auto-release toggle */}
      <button
        type="button"
        onClick={() => setAutoRelease((v) => !v)}
        aria-pressed={autoRelease}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          padding: '13px 15px', borderRadius: 14, marginBottom: 16, cursor: 'pointer',
          border: autoRelease ? '1.5px solid rgba(var(--accent-rgb),.4)' : '1.5px solid #E4E3DF',
          background: autoRelease ? 'rgba(var(--accent-rgb),.06)' : '#fff',
          transition: `all .16s ${ease}`,
        }}
      >
        <span style={{
          width: 40, height: 24, borderRadius: 100, flexShrink: 0, position: 'relative',
          background: autoRelease ? 'var(--accent)' : '#D4D3CF', transition: `background .16s ${ease}`,
        }}>
          <span style={{
            position: 'absolute', top: 3, left: autoRelease ? 19 : 3, width: 18, height: 18, borderRadius: '50%',
            background: '#fff', transition: `left .16s ${ease}`, boxShadow: '0 1px 2px rgba(0,0,0,.2)',
          }} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#0A0A0A' }}>Automatisch freigeben</span>
          <span style={{ display: 'block', fontSize: 12, color: '#909090', marginTop: 2 }}>
            Erzeugte Rechnungen sofort für den Kunden sichtbar machen.
          </span>
        </span>
      </button>

      {/* Line-item builder (mirrors CreateInvoiceModal) */}
      <div style={{ marginTop: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090' }}>Positionen</span>
          <button onClick={addItem} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
            <Plus size={13} strokeWidth={2.5} /> Position
          </button>
        </div>

        {/* column hints */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 64px 28px', gap: 8, padding: '0 2px 6px', fontSize: 10, fontWeight: 600, color: '#B0AFAB', textTransform: 'uppercase', letterSpacing: '.06em' }}>
          <span>Beschreibung</span><span style={{ textAlign: 'center' }}>Mng.</span><span style={{ textAlign: 'right' }}>Einzel €</span><span style={{ textAlign: 'center' }}>MwSt</span><span />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 96px 64px 28px', gap: 8, alignItems: 'center' }}>
              <input className="cos-input" value={it.description} onChange={(e) => updateItem(it.id, { description: e.target.value })} placeholder="Leistung" style={{ padding: '9px 11px', fontSize: 13 }} />
              <input className="cos-input" value={it.quantity} onChange={(e) => updateItem(it.id, { quantity: e.target.value.replace(/[^\d]/g, '') })} inputMode="numeric" style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }} />
              <input className="cos-input" value={it.unitPriceEuro} onChange={(e) => updateItem(it.id, { unitPriceEuro: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ padding: '9px 10px', fontSize: 13, textAlign: 'right' }} />
              <Select value={it.taxRate} onChange={(e) => updateItem(it.id, { taxRate: e.target.value })} style={{ padding: '9px 6px', fontSize: 13, textAlign: 'center' }}>
                {TAX_OPTIONS.map((t) => <option key={t} value={t}>{t}%</option>)}
              </Select>
              <button onClick={() => removeItem(it.id)} disabled={items.length === 1} style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: items.length === 1 ? '#D4D3CF' : '#909090', background: 'transparent' }} aria-label="Position entfernen">
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Live totals */}
      <div style={{ marginTop: 14, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
        <Row label="Zwischensumme" value={fmtEuro(net)} muted />
        <Row label="MwSt." value={fmtEuro(tax)} muted />
        <div style={{ height: 1, background: 'rgba(255,255,255,.1)', margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Gesamtbetrag</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{fmtEuro(gross)}</span>
        </div>
      </div>

      {clients.length === 0 && (
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
