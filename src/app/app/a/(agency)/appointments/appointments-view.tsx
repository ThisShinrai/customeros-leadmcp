'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus, MoreVertical, Trash2, XCircle, CalendarDays, Clock, MapPin, User,
} from 'lucide-react';
import { Topbar } from '@/components/layout/topbar';
import {
  Drawer, Button, Field, Input, Select, Textarea, DropdownMenu, ConfirmDialog,
  useToast, BentoCard, EmptyState,
} from '@/components/ui';
import { fmtDate, fmtTime } from '@/lib/invoices/format';
import { createSlots, cancelAppointment, deleteAppointment } from './actions';
import type { AgencyAppointment, AppointmentStatus } from './queries';

const STATUS_META: Record<AppointmentStatus, { label: string; style: React.CSSProperties }> = {
  available: { label: 'Frei',     style: { background: '#F0FDF4', border: '1.5px solid transparent', color: '#16A34A' } },
  booked:    { label: 'Gebucht',  style: { background: 'rgba(var(--accent-rgb),.12)', border: '1.5px solid transparent', color: 'var(--accent)' } },
  cancelled: { label: 'Abgesagt', style: { background: '#F4F3F0', border: '1.5px solid transparent', color: '#909090' } },
};

function StatusChip({ status }: { status: AppointmentStatus }) {
  const meta = STATUS_META[status];
  return (
    <span style={{ ...meta.style, borderRadius: 100, fontSize: 10, fontWeight: 600, padding: '3px 9px', whiteSpace: 'nowrap', display: 'inline-block' }}>
      {meta.label}
    </span>
  );
}

/** Group appointments by calendar day, preserving start-time order within each day. */
function groupByDay(items: AgencyAppointment[]): { key: string; label: string; items: AgencyAppointment[] }[] {
  const groups: { key: string; label: string; items: AgencyAppointment[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: AgencyAppointment[] }>();
  for (const a of items) {
    const key = `${a.startAt.getFullYear()}-${a.startAt.getMonth()}-${a.startAt.getDate()}`;
    let g = byKey.get(key);
    if (!g) {
      g = { key, label: fmtDate(a.startAt), items: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    g.items.push(a);
  }
  return groups;
}

interface Props {
  appointments: AgencyAppointment[];
  canEdit: boolean;
}

export function AppointmentsView({ appointments, canEdit }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AgencyAppointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgencyAppointment | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = groupByDay(appointments);

  async function handleCancel() {
    if (!cancelTarget) return;
    setBusy(true);
    try {
      await cancelAppointment(cancelTarget.id);
      toast.success('Termin abgesagt. Der Kunde wurde benachrichtigt.');
      setCancelTarget(null);
      router.refresh();
    } catch {
      toast.error('Absage fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteAppointment(deleteTarget.id);
      toast.success('Termin gelöscht.');
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error('Löschen fehlgeschlagen.');
    } finally {
      setBusy(false);
    }
  }

  function menuItems(a: AgencyAppointment) {
    const items: { label: string; icon: React.ReactNode; onClick: () => void; danger?: boolean }[] = [];
    if (a.status === 'available') {
      items.push({ label: 'Löschen', icon: <Trash2 size={14} />, danger: true, onClick: () => setDeleteTarget(a) });
    } else if (a.status === 'booked') {
      items.push({ label: 'Absagen', icon: <XCircle size={14} />, danger: true, onClick: () => setCancelTarget(a) });
    }
    return items;
  }

  return (
    <>
      <Topbar
        title="Termine"
        subtitle="Biete Slots an, die deine Kunden im Portal buchen."
        actions={
          canEdit ? (
            <Button size="sm" icon={<Plus size={14} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)} title="Slot anbieten">
              <span className="cos-desktop-only">Slot anbieten</span>
            </Button>
          ) : undefined
        }
      />

      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {appointments.length === 0 ? (
          <BentoCard interactive={false} padding={0}>
            <EmptyState
              icon={<CalendarDays size={24} />}
              title="Noch keine Termine angeboten"
              description="Biete Zeit-Slots an — deine Kunden buchen sie direkt im Portal und du wirst benachrichtigt."
              action={canEdit ? (
                <Button icon={<Plus size={15} strokeWidth={2.5} />} onClick={() => setCreateOpen(true)}>Slot anbieten</Button>
              ) : undefined}
            />
          </BentoCard>
        ) : (
          groups.map((group) => (
            <BentoCard key={group.key} interactive={false} padding={0} style={{ overflow: 'hidden' }}>
              {/* Slim dark day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px', background: '#0A0A0A', color: '#fff' }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <CalendarDays size={15} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff' }}>{group.label}</span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap' }}>
                  {group.items.length} {group.items.length === 1 ? 'Slot' : 'Slots'}
                </span>
              </div>

              {group.items.map((a, idx) => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 16px',
                    padding: '15px 22px',
                    borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                    opacity: a.status === 'cancelled' ? 0.6 : 1,
                  }}
                >
                  {/* Time range */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 124, flexShrink: 0 }}>
                    <Clock size={14} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.2px', textDecoration: a.status === 'cancelled' ? 'line-through' : 'none' }}>
                      {fmtTime(a.startAt)}<span style={{ color: '#C4C4C0', fontWeight: 500 }}>–</span>{fmtTime(a.endAt)}
                    </span>
                  </div>

                  {/* Title + location + booking info */}
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: 12, color: '#909090', flexWrap: 'wrap' }}>
                      {a.location && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 240 }}>
                          <MapPin size={12} style={{ flexShrink: 0 }} /> {a.location}
                        </span>
                      )}
                      {a.status === 'booked' && a.bookedClientName && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent)', fontWeight: 600 }}>
                          <User size={12} style={{ flexShrink: 0 }} /> {a.bookedClientName}
                        </span>
                      )}
                    </div>
                    {a.status === 'booked' && a.bookedNote && (
                      <div style={{ marginTop: 6, fontSize: 12.5, color: '#505050', lineHeight: 1.45, background: '#FAFAF9', border: '1px solid #F0EFEC', borderRadius: 10, padding: '7px 11px', maxWidth: 460 }}>
                        „{a.bookedNote}"
                      </div>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', marginLeft: 'auto', flexShrink: 0 }}>
                    <StatusChip status={a.status} />
                    {canEdit && menuItems(a).length > 0 && (
                      <DropdownMenu
                        trigger={
                          <button style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid #E4E3DF', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#909090', cursor: 'pointer' }}>
                            <MoreVertical size={15} />
                          </button>
                        }
                        items={menuItems(a)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </BentoCard>
          ))
        )}
      </div>

      {canEdit && (
        <CreateSlotsDrawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        loading={busy}
        danger
        title="Termin absagen?"
        message="Der gebuchte Slot wird als abgesagt markiert und der Kunde per E-Mail benachrichtigt."
        confirmLabel="Termin absagen"
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={busy}
        danger
        title="Termin löschen?"
        message="Dieser freie Slot wird unwiderruflich gelöscht."
        confirmLabel="Endgültig löschen"
      />
    </>
  );
}

/* ─────────────────────────── Create Drawer ─────────────────────────── */

const DURATION_OPTIONS = [
  { value: '15', label: '15 Minuten' },
  { value: '30', label: '30 Minuten' },
  { value: '45', label: '45 Minuten' },
  { value: '60', label: '60 Minuten' },
  { value: '90', label: '90 Minuten' },
];

/** Build a UTC ISO string from a yyyy-mm-dd + HH:mm pair (parsed as local time). */
function isoFrom(date: string, time: string): string | null {
  const d = new Date(`${date}T${time}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Compute the slot list from the form state (single slot or back-to-back series). */
function buildSlots(opts: {
  date: string; time: string; duration: number; series: boolean; untilTime: string;
}): { startAt: string; endAt: string }[] {
  const { date, time, duration, series, untilTime } = opts;
  if (!date || !time) return [];
  const slots: { startAt: string; endAt: string }[] = [];

  const start = new Date(`${date}T${time}:00`);
  if (isNaN(start.getTime())) return [];

  if (!series) {
    const end = new Date(start.getTime() + duration * 60_000);
    return [{ startAt: start.toISOString(), endAt: end.toISOString() }];
  }

  if (!untilTime) return [];
  const until = new Date(`${date}T${untilTime}:00`);
  if (isNaN(until.getTime()) || until.getTime() <= start.getTime()) return [];

  let cursor = start.getTime();
  // Cap at 60 to respect the server limit; stop once a full slot no longer fits before `until`.
  while (slots.length < 60) {
    const end = cursor + duration * 60_000;
    if (end > until.getTime()) break;
    slots.push({ startAt: new Date(cursor).toISOString(), endAt: new Date(end).toISOString() });
    cursor = end;
  }
  return slots;
}

function CreateSlotsDrawer({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [series, setSeries] = useState(false);
  const [untilTime, setUntilTime] = useState('');

  const preview = buildSlots({ date, time, duration: Number(duration), series, untilTime });

  function reset() {
    setTitle(''); setDescription(''); setLocation('');
    setDate(''); setTime(''); setDuration('30'); setSeries(false); setUntilTime('');
  }

  function close() {
    if (loading) return;
    reset();
    onClose();
  }

  async function submit() {
    if (!title.trim()) { toast.error('Bitte gib einen Titel ein.'); return; }
    if (!date || !time) { toast.error('Bitte wähle Datum und Uhrzeit.'); return; }
    if (series && !untilTime) { toast.error('Bitte gib eine Bis-Uhrzeit für die Serie an.'); return; }
    const slots = buildSlots({ date, time, duration: Number(duration), series, untilTime });
    if (slots.length === 0) {
      toast.error(series ? 'Kein gültiger Slot — prüfe Uhrzeit, Dauer und Bis-Uhrzeit.' : 'Ungültige Zeit.');
      return;
    }

    setLoading(true);
    try {
      const res = await createSlots({
        title: title.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        slots,
      });
      toast.success(`Termine erstellt: ${res.count}`);
      reset();
      onSaved();
      onClose();
    } catch {
      toast.error('Termine konnten nicht erstellt werden.');
      setLoading(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Slot anbieten"
      subtitle="Lege einen oder mehrere Termine an — Kunden buchen sie direkt im Portal."
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={loading}>Abbrechen</Button>
          <Button onClick={submit} loading={loading}>
            {series && preview.length > 1 ? `${preview.length} Termine anlegen` : 'Termin anlegen'}
          </Button>
        </>
      }
    >
      <Field label="Titel">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z.B. Erstgespräch, Kickoff-Call" autoFocus />
      </Field>

      <Field label="Beschreibung" hint="Optional. Wird dem Kunden im Portal angezeigt.">
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Worum geht es in diesem Termin?" style={{ lineHeight: 1.5 }} />
      </Field>

      <Field label="Ort" hint="Optional, z.B. Video-Call, Telefon oder eine Adresse.">
        <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Video-Call, Telefon, Adresse …" />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Field label="Datum">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Uhrzeit">
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Dauer">
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      {/* Series toggle */}
      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', borderRadius: 12, background: 'var(--wash)', border: `1.5px solid ${series ? 'var(--accent)' : 'var(--line)'}`, transition: 'border-color .14s', marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={series}
          onChange={(e) => setSeries(e.target.checked)}
          style={{ width: 18, height: 18, marginTop: 1, accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, lineHeight: 1.4 }}>
            Mehrere Slots an diesem Tag (Serie)
          </span>
          <span style={{ display: 'block', fontSize: 12.5, color: 'var(--faint)', marginTop: 2, lineHeight: 1.45 }}>
            Erzeugt nahtlos aufeinanderfolgende Slots der gewählten Dauer.
          </span>
        </span>
      </label>

      {series && (
        <Field label="Bis-Uhrzeit" hint="Slots werden von der Uhrzeit bis zu dieser Zeit erzeugt.">
          <Input type="time" value={untilTime} onChange={(e) => setUntilTime(e.target.value)} />
        </Field>
      )}

      {/* Live preview */}
      <div style={{ marginTop: 6, padding: '14px 16px', background: '#0A0A0A', borderRadius: 14, color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>
            {series ? 'Slots in dieser Serie' : 'Vorschau'}
          </span>
          <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {preview.length}
          </span>
        </div>
        {preview.length > 0 ? (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {preview.slice(0, 12).map((s, i) => (
              <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: '#fff', background: 'rgba(255,255,255,.1)', borderRadius: 100, padding: '4px 10px', fontVariantNumeric: 'tabular-nums' }}>
                {fmtTime(new Date(s.startAt))}
              </span>
            ))}
            {preview.length > 12 && (
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,.55)', padding: '4px 4px' }}>
                +{preview.length - 12} weitere
              </span>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 8, fontSize: 12.5, color: 'rgba(255,255,255,.5)', lineHeight: 1.5 }}>
            Wähle Datum und Uhrzeit{series ? ' sowie eine spätere Bis-Uhrzeit' : ''}, um die Slots zu erzeugen.
          </div>
        )}
      </div>
    </Drawer>
  );
}
