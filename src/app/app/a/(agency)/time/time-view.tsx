'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, Trash2, Clock, Timer, ReceiptText, FolderOpen, User, CheckCircle2, Wallet,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Drawer, Modal, Button, Field, Input, Select, ConfirmDialog,
  useToast, BentoCard, EmptyState,
} from '@/components/ui';
import { fmtDate } from '@/lib/invoices/format';
import { logTime, deleteTime, billTime } from './actions';
import type { TimeData, TimeEntryItem } from './queries';

/* ─────────────────────────── Helpers ─────────────────────────── */

/** minutes → "Xh Ym" (omit a leading 0h, omit a trailing 0m). */
function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** minutes → German decimal hours, e.g. "12,5 h". */
function fmtHours(minutes: number): string {
  const hours = minutes / 60;
  const str = hours.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
  return `${str} h`;
}

/** yyyy-mm-dd for a date input default (local today). */
function todayInput(): string {
  const d = new Date();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

interface ProjectGroup {
  projectId: string;
  projectName: string;
  entries: TimeEntryItem[];
  totalMinutes: number;
  unbilledBillableCount: number;
}

/** Group entries by project, preserving the (already date-desc) order within a group. */
function groupByProject(entries: TimeEntryItem[]): ProjectGroup[] {
  const groups: ProjectGroup[] = [];
  const byKey = new Map<string, ProjectGroup>();
  for (const e of entries) {
    let g = byKey.get(e.projectId);
    if (!g) {
      g = { projectId: e.projectId, projectName: e.projectName, entries: [], totalMinutes: 0, unbilledBillableCount: 0 };
      byKey.set(e.projectId, g);
      groups.push(g);
    }
    g.entries.push(e);
    g.totalMinutes += e.minutes;
    if (e.billable && !e.billed) g.unbilledBillableCount += 1;
  }
  return groups;
}

/* ─────────────────────────── Chips ─────────────────────────── */

function BillableChip({ billable }: { billable: boolean }) {
  const style: React.CSSProperties = billable
    ? { background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)' }
    : { background: '#F4F3F0', color: '#909090' };
  return (
    <span style={{ ...style, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {billable ? 'abrechenbar' : 'nicht abrechenbar'}
    </span>
  );
}

function BilledChip() {
  return (
    <span style={{ background: '#F0FDF4', color: '#16A34A', borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <CheckCircle2 size={11} /> abgerechnet
    </span>
  );
}

/* ─────────────────────────── View ─────────────────────────── */

interface Props {
  data: TimeData;
  canEdit: boolean;
  canBill: boolean;
}

export function TimeView({ data, canEdit, canBill }: Props) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [billTarget, setBillTarget] = useState<ProjectGroup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeEntryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const groups = groupByProject(data.entries);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTime(deleteTarget.id);
      toast.success('Eintrag gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Topbar
        title="Zeiterfassung"
        subtitle="Stunden erfassen und abrechnen."
        actions={
          canEdit ? (
            <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)} title="Zeit erfassen">
              <span className="cos-desktop-only">Zeit erfassen</span>
            </Button>
          ) : undefined
        }
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <SummaryTile
            icon={<Clock size={16} />}
            label="Gesamt-Stunden"
            value={fmtHours(data.totalMinutes)}
            sub={`${data.entries.length} ${data.entries.length === 1 ? 'Eintrag' : 'Einträge'}`}
          />
          <SummaryTile
            icon={<Wallet size={16} />}
            label="Offen abrechenbar"
            value={fmtHours(data.unbilledBillableMinutes)}
            sub="noch nicht in Rechnung"
            accent
          />
        </div>

        {/* Entry list grouped by project */}
        {data.entries.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<Timer size={24} />}
              title="Noch keine Zeiten erfasst"
              description="Erfasse deine geleisteten Stunden pro Projekt und rechne abrechenbare Einträge mit einem Klick als Rechnung ab."
              action={canEdit ? (
                <Button icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>Zeit erfassen</Button>
              ) : undefined}
            />
          </BentoCard>
        ) : (
          groups.map((group) => (
            <BentoCard key={group.projectId} interactive={false} padding={0} style={{ overflow: 'hidden' }}>
              {/* Dark project header strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', background: '#0A0A0A', color: '#fff' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FolderOpen size={15} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.projectName}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtHours(group.totalMinutes)}
                </span>
                {canBill && group.unbilledBillableCount > 0 && (
                  <button
                    onClick={() => setBillTarget(group)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 4,
                      borderRadius: 100, fontSize: 12, fontWeight: 700, padding: '6px 13px',
                      background: 'var(--accent)', color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap',
                      transition: 'transform .14s var(--ease), opacity .14s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                    title="Abrechenbare Einträge als Rechnung erstellen"
                  >
                    <ReceiptText size={13} /> Abrechnen
                  </button>
                )}
              </div>

              {group.entries.map((e, idx) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 16px',
                    padding: '15px 22px',
                    borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                  }}
                >
                  {/* Date */}
                  <div className="time-date" style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 104, flexShrink: 0 }}>
                    <Clock size={14} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#505050', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtDate(e.occurredAt)}
                    </span>
                  </div>

                  {/* Description + user */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                    {e.userName && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 12, color: '#909090' }}>
                        <User size={12} style={{ flexShrink: 0 }} /> {e.userName}
                      </div>
                    )}
                  </div>

                  {/* Duration */}
                  <div style={{ minWidth: 64, textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-.3px', fontVariantNumeric: 'tabular-nums' }}>
                      {fmtDuration(e.minutes)}
                    </span>
                  </div>

                  {/* Chips + delete */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexShrink: 0 }}>
                    <BillableChip billable={e.billable} />
                    {e.billed && <BilledChip />}
                    {canEdit && !e.billed && (
                      <button
                        onClick={() => setDeleteTarget(e)}
                        style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E4E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', cursor: 'pointer', flexShrink: 0, transition: 'background .14s, color .14s, border-color .14s' }}
                        onMouseEnter={(ev) => { ev.currentTarget.style.background = '#FEF2F2'; ev.currentTarget.style.color = '#DC2626'; ev.currentTarget.style.borderColor = '#FECACA'; }}
                        onMouseLeave={(ev) => { ev.currentTarget.style.background = '#fff'; ev.currentTarget.style.color = '#909090'; ev.currentTarget.style.borderColor = '#E4E3DF'; }}
                        aria-label="Eintrag löschen"
                        title="Eintrag löschen"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </BentoCard>
          ))
        )}

        <style>{`
          @media (max-width: 560px) {
            .time-date { min-width: 0 !important; flex-basis: 100% !important; }
          }
        `}</style>
      </div>

      {canEdit && (
        <LogTimeDrawer
          open={createOpen}
          projects={data.projects}
          onClose={() => setCreateOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      {canBill && billTarget && (
        <BillModal
          group={billTarget}
          onClose={() => setBillTarget(null)}
          onBilled={() => { setBillTarget(null); router.refresh(); }}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        danger
        title="Eintrag löschen?"
        message="Dieser Zeiteintrag wird unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
      />
    </>
  );
}

/* ─────────────────────────── Summary Tile ─────────────────────────── */

function SummaryTile({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <BentoCard interactive={false} style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: accent ? 'rgba(var(--accent-rgb),.12)' : 'var(--wash)',
          color: accent ? 'var(--accent)' : 'var(--mid)',
        }}>
          {icon}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: '#909090' }}>{label}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent ? 'var(--accent)' : '#0A0A0A', letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: '#909090', marginTop: 7 }}>{sub}</div>
    </BentoCard>
  );
}

/* ─────────────────────────── Log Time Drawer ─────────────────────────── */

function LogTimeDrawer({ open, projects, onClose, onSaved }: {
  open: boolean;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [date, setDate] = useState(todayInput());
  const [billable, setBillable] = useState(true);
  const [rateEuro, setRateEuro] = useState('');

  const totalMinutes = (Number(hours || '0') * 60) + Number(minutes || '0');

  function reset() {
    setProjectId(''); setDescription(''); setHours(''); setMinutes('');
    setDate(todayInput()); setBillable(true); setRateEuro('');
  }

  function close() {
    if (loading) return;
    reset();
    onClose();
  }

  async function submit() {
    if (!projectId) { toast.error('Bitte wähle ein Projekt.'); return; }
    if (!description.trim()) { toast.error('Bitte gib eine Beschreibung ein.'); return; }
    if (totalMinutes <= 0) { toast.error('Bitte gib eine Dauer größer als 0 an.'); return; }
    if (!date) { toast.error('Bitte wähle ein Datum.'); return; }

    let rateCents: number | undefined;
    if (rateEuro.trim()) {
      const euro = parseFloat(rateEuro.replace(/\./g, '').replace(',', '.'));
      if (isFinite(euro) && euro > 0) rateCents = Math.round(euro * 100);
    }

    setLoading(true);
    try {
      await logTime({
        projectId,
        description: description.trim(),
        minutes: totalMinutes,
        occurredAt: new Date(date).toISOString(),
        billable,
        rateCents,
      });
      toast.success('Zeit erfasst.');
      reset();
      onSaved();
      onClose();
    } catch {
      toast.error('Zeit konnte nicht erfasst werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Zeit erfassen"
      subtitle="Erfasse geleistete Stunden für ein Projekt — abrechenbare Einträge kannst du später als Rechnung erstellen."
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>Zeit erfassen</Button>
        </>
      }
    >
      <Field label="Projekt">
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} autoFocus>
          <option value="">Projekt wählen…</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>

      <Field label="Beschreibung">
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="z.B. Konzeption Startseite, Abstimmung Kunde" maxLength={300} />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12 }}>
        <Field label="Stunden">
          <Input value={hours} onChange={(e) => setHours(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Minuten">
          <Input value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Datum">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>

      {/* Billable toggle */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: 'var(--wash)', border: `1.5px solid ${billable ? 'var(--accent)' : 'var(--line)'}`, transition: 'border-color .14s', marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={billable}
          onChange={(e) => setBillable(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.4 }}>
            Abrechenbar
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--faint)', marginTop: 2, lineHeight: 1.45 }}>
            Nur abrechenbare Einträge fließen in eine Rechnung ein.
          </span>
        </span>
      </label>

      <Field label="Stundensatz (€)" hint="Optional. Überschreibt für diesen Eintrag den Standard-Stundensatz beim Abrechnen.">
        <Input value={rateEuro} onChange={(e) => setRateEuro(e.target.value)} inputMode="decimal" placeholder="z.B. 95,00" />
      </Field>

      {/* Live duration preview */}
      <div style={{ marginTop: 6, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>Erfasste Dauer</span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {totalMinutes > 0 ? fmtDuration(totalMinutes) : '—'}
          </span>
        </div>
      </div>

      {projects.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--faint)', background: 'var(--wash)', padding: '12px 14px', borderRadius: 12, marginTop: 12 }}>
          Noch keine Projekte angelegt. Bitte erstelle zuerst unter <strong>Projekte</strong> ein Projekt.
        </div>
      )}
    </Drawer>
  );
}

/* ─────────────────────────── Bill Modal ─────────────────────────── */

function BillModal({ group, onClose, onBilled }: {
  group: ProjectGroup;
  onClose: () => void;
  onBilled: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [rateEuro, setRateEuro] = useState('');
  const [taxRate, setTaxRate] = useState('19');
  const [title, setTitle] = useState('');

  async function submit() {
    const euro = parseFloat(rateEuro.replace(/\./g, '').replace(',', '.'));
    const defaultRateCents = isFinite(euro) ? Math.round(euro * 100) : 0;
    if (defaultRateCents <= 0) { toast.error('Bitte gib einen Standard-Stundensatz an.'); return; }
    const tax = Number(taxRate);
    if (!Number.isInteger(tax) || tax < 0 || tax > 100) { toast.error('Ungültiger MwSt.-Satz.'); return; }

    setLoading(true);
    try {
      const res = await billTime({
        projectId: group.projectId,
        defaultRateCents,
        taxRate: tax,
        title: title.trim() || undefined,
      });
      if (res.ok) {
        toast.success('Rechnung erstellt.');
        if (res.invoiceId) {
          router.push('/app/a/invoices/' + res.invoiceId);
        } else {
          onBilled();
        }
      } else {
        if (res.reason === 'NOTHING') toast.error('Keine offenen abrechenbaren Einträge.');
        else if (res.reason === 'NO_CLIENT') toast.error('Projekt hat keinen zugeordneten Kunden.');
        else toast.error('Projekt nicht gefunden.');
        setLoading(false);
      }
    } catch {
      toast.error('Rechnung konnte nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => { if (!loading) onClose(); }}
      title="Zeiten abrechnen"
      subtitle={`Alle offenen abrechenbaren Einträge von „${group.projectName}" werden zu einer Rechnung gebündelt.`}
      width={460}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading} icon={<ReceiptText size={15} />}>Rechnung erstellen</Button>
        </>
      }
    >
      {/* Summary banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', background: 'var(--wash)', borderRadius: 14, marginBottom: 18 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Timer size={18} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0A0A0A' }}>
            {group.unbilledBillableCount} {group.unbilledBillableCount === 1 ? 'offener Eintrag' : 'offene Einträge'}
          </div>
          <div style={{ fontSize: 12.5, color: '#909090', marginTop: 1 }}>
            Einträge ohne eigenen Stundensatz nutzen den Standardwert.
          </div>
        </div>
      </div>

      <Field label="Standard-Stundensatz (€)" hint="Gilt für Einträge ohne eigenen Stundensatz.">
        <Input value={rateEuro} onChange={(e) => setRateEuro(e.target.value)} inputMode="decimal" placeholder="z.B. 95,00" autoFocus />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
        <Field label="MwSt. (%)">
          <Input value={taxRate} onChange={(e) => setTaxRate(e.target.value.replace(/[^\d]/g, ''))} inputMode="numeric" placeholder="19" />
        </Field>
      </div>

      <Field label="Titel der Rechnung" hint="Optional — Standard: Leistungen + Projektname.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Leistungen Mai 2026" maxLength={160} />
      </Field>
    </Modal>
  );
}
