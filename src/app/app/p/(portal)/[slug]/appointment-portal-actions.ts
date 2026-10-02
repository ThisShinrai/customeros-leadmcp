'use server';

import { and, asc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { appointments } from '@/lib/db';
import { requirePortalSession } from '@/lib/auth/session';
import { notifyClient, notifyAgency } from '@/lib/email/notify';
import { logAudit } from '@/lib/audit';
import { fmtBerlinDateTime } from '@/lib/invoices/format';

export interface PortalAppointment {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date;
  bookedNote: string | null;
}

/** Upcoming available slots + the client's own booked slots. */
export async function getPortalAppointments(): Promise<{ available: PortalAppointment[]; mine: PortalAppointment[] }> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const now = Date.now();
  const rows = await db.select().from(appointments)
    .where(eq(appointments.agencyId, s.agencyId))
    .orderBy(asc(appointments.startAt));

  const map = (r: typeof rows[number]): PortalAppointment => ({
    id: r.id, title: r.title, description: r.description, location: r.location,
    startAt: r.startAt, endAt: r.endAt, bookedNote: r.bookedNote,
  });
  const available = rows.filter((r) => r.status === 'available' && r.endAt && r.endAt.getTime() >= now).map(map);
  const mine = rows.filter((r) => r.status === 'booked' && r.bookedClientId === s.client.id && r.endAt && r.endAt.getTime() >= now).map(map);
  return { available, mine };
}

/** Book an available slot. Race-safe: the update only matches `available`. */
export async function bookAppointment(id: string, note: string): Promise<{ ok: boolean; error?: string }> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const apt = await db.query.appointments.findFirst({ where: and(eq(appointments.id, id), eq(appointments.agencyId, s.agencyId)) });
  if (!apt) return { ok: false, error: 'NOT_FOUND' };
  if (apt.status !== 'available') return { ok: false, error: 'TAKEN' };

  const cleanNote = String(note || '').trim().slice(0, 500);
  const res = await db.update(appointments)
    .set({ status: 'booked', bookedClientId: s.client.id, bookedAt: new Date(), bookedNote: cleanNote || null, updatedAt: new Date() })
    .where(and(eq(appointments.id, id), eq(appointments.status, 'available')))
    .returning({ id: appointments.id });
  if (res.length === 0) return { ok: false, error: 'TAKEN' };

  await logAudit(db, {
    agencyId: s.agencyId, actorId: s.client.id, actorName: s.client.name,
    action: 'appointment.booked', targetType: 'appointment', targetId: id, meta: { title: apt.title },
  });
  await notifyClient(db, {
    clientId: s.client.id, agencyId: s.agencyId,
    heading: `Termin bestätigt: ${apt.title}`,
    body: `Ihr Termin ist reserviert für ${fmtBerlinDateTime(apt.startAt)} Uhr${apt.location ? ` · ${apt.location}` : ''}.`,
    path: `/app/p/${s.agency.slug}/termine`, ctaLabel: 'Termine ansehen',
  });
  await notifyAgency(db, {
    agencyId: s.agencyId,
    heading: `Neue Terminbuchung: ${apt.title}`,
    body: `${s.client.name} hat den Termin am ${fmtBerlinDateTime(apt.startAt)} Uhr gebucht.${cleanNote ? ` — Notiz: ${cleanNote}` : ''}`,
    path: `/app/a/appointments`, ctaLabel: 'Im Dashboard ansehen',
  });

  revalidatePath(`/app/p/${s.agency.slug}/termine`);
  return { ok: true };
}

/** Client cancels their own booking → the slot becomes available again. */
export async function cancelMyBooking(id: string): Promise<{ ok: boolean }> {
  const s = await requirePortalSession();
  const db = await getRequestDb();
  const apt = await db.query.appointments.findFirst({
    where: and(eq(appointments.id, id), eq(appointments.agencyId, s.agencyId), eq(appointments.bookedClientId, s.client.id)),
  });
  if (!apt) return { ok: false };

  await db.update(appointments)
    .set({ status: 'available', bookedClientId: null, bookedAt: null, bookedNote: null, updatedAt: new Date() })
    .where(eq(appointments.id, id));

  await notifyAgency(db, {
    agencyId: s.agencyId,
    heading: 'Terminbuchung storniert',
    body: `${s.client.name} hat die Buchung „${apt.title}" am ${fmtBerlinDateTime(apt.startAt)} Uhr storniert.`,
    path: `/app/a/appointments`,
  });
  revalidatePath(`/app/p/${s.agency.slug}/termine`);
  return { ok: true };
}
