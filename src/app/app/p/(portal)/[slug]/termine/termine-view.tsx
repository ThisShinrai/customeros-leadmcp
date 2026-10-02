'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Clock, MapPin, CalendarCheck, CalendarPlus } from 'lucide-react';
import { Modal, ConfirmDialog, Button, Field, Textarea, useToast, BentoCard, EmptyState } from '@/components/ui';
import { fmtDate, fmtTime } from '@/lib/invoices/format';
import { bookAppointment, cancelMyBooking, type PortalAppointment } from '../appointment-portal-actions';

function Label({ children, color = '#909090' }: { children: React.ReactNode; color?: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.13em', color, lineHeight: 1 }}>{children}</span>;
}

/** Group slots by calendar day, preserving start-time order within each day. */
function groupByDay(items: PortalAppointment[]): { key: string; label: string; items: PortalAppointment[] }[] {
  const groups: { key: string; label: string; items: PortalAppointment[] }[] = [];
  const byKey = new Map<string, { key: string; label: string; items: PortalAppointment[] }>();
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
  slug: string;
  available: PortalAppointment[];
  mine: PortalAppointment[];
}

export function TermineView({ available, mine }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [bookTarget, setBookTarget] = useState<PortalAppointment | null>(null);
  const [note, setNote] = useState('');
  const [booking, setBooking] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<PortalAppointment | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const groups = groupByDay(available);

  function openBook(a: PortalAppointment) {
    setBookTarget(a);
    setNote('');
  }

  async function handleBook() {
    if (!bookTarget) return;
    setBooking(true);
    try {
      const res = await bookAppointment(bookTarget.id, note.trim());
      if (res.ok) {
        toast.success('Termin gebucht');
        setBookTarget(null);
        router.refresh();
      } else if (res.error === 'TAKEN') {
        toast.error('Dieser Slot wurde gerade vergeben.');
        setBookTarget(null);
        router.refresh();
      } else {
        toast.error('Buchung fehlgeschlagen.');
      }
    } catch {
      toast.error('Buchung fehlgeschlagen.');
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const res = await cancelMyBooking(cancelTarget.id);
      if (res.ok) {
        toast.success('Buchung storniert.');
        setCancelTarget(null);
        router.refresh();
      } else {
        toast.error('Stornierung fehlgeschlagen.');
      }
    } catch {
      toast.error('Stornierung fehlgeschlagen.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <div style={{ padding: '20px 24px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h1 style={{ fontSize: 33, fontWeight: 800, letterSpacing: '-1.4px', color: '#0A0A0A', margin: 0, lineHeight: 1.02 }}>Termine</h1>

        {/* ── Meine Termine ── */}
        {mine.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ padding: '0 4px' }}><Label color="#0A0A0A">Meine Termine</Label></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 12 }} className="termine-mine-grid">
              {mine.map((a) => (
                <BentoCard key={a.id} interactive={false} padding="18px 20px" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13 }}>
                    <span style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CalendarCheck size={20} />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-.3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                      <div style={{ fontSize: 12.5, color: '#909090', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, color: '#505050' }}>
                          <CalendarDays size={13} /> {fmtDate(a.startAt)}
                        </span>
                        <span style={{ color: '#D4D3CF' }}>·</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}>
                          <Clock size={13} /> {fmtTime(a.startAt)}–{fmtTime(a.endAt)}
                        </span>
                      </div>
                      {a.location && (
                        <div style={{ fontSize: 12.5, color: '#909090', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <MapPin size={13} /> {a.location}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="secondary" size="sm" onClick={() => setCancelTarget(a)}>Stornieren</Button>
                  </div>
                </BentoCard>
              ))}
            </div>
          </section>
        )}

        {/* ── Verfügbare Termine ── */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '0 4px' }}><Label color="#0A0A0A">Verfügbare Termine</Label></div>

          {available.length === 0 ? (
            <BentoCard interactive={false} padding={0}>
              <EmptyState
                icon={<CalendarDays size={24} />}
                title="Keine freien Termine"
                description="Aktuell bietet Ihre Agentur keine buchbaren Termine an. Schauen Sie später noch einmal vorbei."
              />
            </BentoCard>
          ) : (
            groups.map((group) => (
              <BentoCard key={group.key} interactive={false} padding={0} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', background: '#0A0A0A', color: '#fff' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(var(--accent-rgb),.22)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarDays size={15} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.2px', color: '#fff' }}>{group.label}</span>
                </div>

                {group.items.map((a, idx) => (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px 14px',
                      padding: '15px 20px',
                      borderTop: idx === 0 ? 'none' : '1px solid #F0EFEC',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 118, flexShrink: 0 }}>
                      <Clock size={14} style={{ color: '#C4C4C0', flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#0A0A0A', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.2px' }}>
                        {fmtTime(a.startAt)}<span style={{ color: '#C4C4C0', fontWeight: 500 }}>–</span>{fmtTime(a.endAt)}
                      </span>
                    </div>

                    <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                      {a.location && (
                        <div style={{ fontSize: 12, color: '#909090', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          <MapPin size={12} style={{ flexShrink: 0 }} /> {a.location}
                        </div>
                      )}
                    </div>

                    <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
                      <Button size="sm" onClick={() => openBook(a)}>Buchen</Button>
                    </div>
                  </div>
                ))}
              </BentoCard>
            ))
          )}
        </section>
      </div>

      {/* ── Booking modal ── */}
      <Modal
        open={!!bookTarget}
        onClose={() => !booking && setBookTarget(null)}
        title="Termin buchen"
        subtitle={bookTarget ? `${fmtDate(bookTarget.startAt)} · ${fmtTime(bookTarget.startAt)}–${fmtTime(bookTarget.endAt)}` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBookTarget(null)} disabled={booking}>Abbrechen</Button>
            <Button variant="primary" loading={booking} onClick={handleBook} icon={<CalendarPlus size={15} />}>Verbindlich buchen</Button>
          </>
        }
      >
        {bookTarget && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'var(--wash)', border: '1px solid var(--line)', marginBottom: 16 }}>
              <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(var(--accent-rgb),.12)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarCheck size={19} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--black)', letterSpacing: '-.3px' }}>{bookTarget.title}</div>
                {bookTarget.location && (
                  <div style={{ fontSize: 12.5, color: 'var(--faint)', marginTop: 3, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <MapPin size={13} /> {bookTarget.location}
                  </div>
                )}
                {bookTarget.description && (
                  <div style={{ fontSize: 12.5, color: 'var(--mid)', marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{bookTarget.description}</div>
                )}
              </div>
            </div>
            <Field label="Notiz" hint="Optional. Hilft Ihrer Agentur, sich vorzubereiten.">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Worum geht's? (optional)"
                style={{ lineHeight: 1.5 }}
                autoFocus
              />
            </Field>
          </>
        )}
      </Modal>

      {/* ── Cancel confirm ── */}
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => !cancelling && setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Buchung stornieren?"
        message="Möchten Sie diesen Termin wirklich stornieren? Der Slot wird danach wieder für andere freigegeben."
        confirmLabel="Stornieren"
        danger
        loading={cancelling}
      />

      <style>{`
        @media (min-width: 760px) {
          .termine-mine-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </>
  );
}
