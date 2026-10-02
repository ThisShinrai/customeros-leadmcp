'use server';

import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getRequestDb } from '@/lib/db';
import { appointments } from '@/lib/db';
import { requireAgencySession, assertCan } from '@/lib/auth/session';
import { notifyClient } from '@/lib/email/notify';
import { fmtBerlinDateTime } from '@/lib/invoices/format';

const SlotSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

const CreateSchema = z.object({
  title: z.string().trim().min(1, 'Titel fehlt').max(160),
  description: z.string().trim().max(1000).optional().or(z.literal('')),
  location: z.string().trim().max(160).optional().or(z.literal('')),
  slots: z.array(SlotSchema).min(1, 'Mindestens ein Slot').max(60, 'Maximal 60 Slots auf einmal'),
});

/** Create one or many available slots (the client computes the UTC ISO times). */
export async function createSlots(input: unknown): Promise<{ ok: true; count: number }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const data = CreateSchema.parse(input);
  const db = await getRequestDb();

  const rows = data.slots
    .filter((slot) => new Date(slot.endAt).getTime() > new Date(slot.startAt).getTime())
    .map((slot) => ({
      agencyId: s.agencyId,
      title: data.title,
      description: data.description || null,
      location: data.location || null,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
      status: 'available' as const,
    }));
  if (rows.length === 0) throw new Error('Ungültige Zeiten.');

  await db.insert(appointments).values(rows);
  revalidatePath('/app/a/appointments');
  return { ok: true, count: rows.length };
}

/** Cancel a slot (keeps the row; notifies the client if it was booked). */
export async function cancelAppointment(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const apt = await db.query.appointments.findFirst({ where: and(eq(appointments.id, id), eq(appointments.agencyId, s.agencyId)) });
  if (!apt) throw new Error('NOT_FOUND');

  await db.update(appointments).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(appointments.id, id));

  if (apt.status === 'booked' && apt.bookedClientId) {
    await notifyClient(db, {
      clientId: apt.bookedClientId, agencyId: s.agencyId,
      heading: 'Termin abgesagt',
      body: `Der Termin „${apt.title}" am ${fmtBerlinDateTime(apt.startAt)} Uhr wurde leider abgesagt.`,
      path: `/app/p/${s.agency.slug}/termine`,
      ctaLabel: 'Termine ansehen',
    });
  }
  revalidatePath('/app/a/appointments');
  return { ok: true };
}

/** Permanently delete a slot (e.g. an unused available one). */
export async function deleteAppointment(id: string): Promise<{ ok: true }> {
  const s = await requireAgencySession();
  assertCan(s, 'projects:edit');
  const db = await getRequestDb();
  const apt = await db.query.appointments.findFirst({ where: and(eq(appointments.id, id), eq(appointments.agencyId, s.agencyId)) });
  if (!apt) throw new Error('NOT_FOUND');
  await db.delete(appointments).where(eq(appointments.id, id));
  revalidatePath('/app/a/appointments');
  return { ok: true };
}
