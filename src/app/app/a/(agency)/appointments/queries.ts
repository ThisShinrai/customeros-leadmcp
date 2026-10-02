import { asc, eq, inArray } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { appointments, clientUsers } from '@/lib/db';

export type AppointmentStatus = 'available' | 'booked' | 'cancelled';

export interface AgencyAppointment {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  status: AppointmentStatus;
  startAt: Date;
  endAt: Date;
  bookedClientName: string | null;
  bookedNote: string | null;
  bookedAt: Date | null;
}

export async function listAgencyAppointments(agencyId: string): Promise<AgencyAppointment[]> {
  const db = await getRequestDb();
  const rows = await db.select().from(appointments)
    .where(eq(appointments.agencyId, agencyId))
    .orderBy(asc(appointments.startAt));
  if (rows.length === 0) return [];

  const bookedIds = [...new Set(rows.filter((r) => r.bookedClientId).map((r) => r.bookedClientId as string))];
  const clients = bookedIds.length
    ? await db.select({ id: clientUsers.id, name: clientUsers.name }).from(clientUsers).where(inArray(clientUsers.id, bookedIds))
    : [];
  const nameById = new Map(clients.map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    status: r.status,
    startAt: r.startAt,
    endAt: r.endAt,
    bookedClientName: r.bookedClientId ? (nameById.get(r.bookedClientId) ?? '—') : null,
    bookedNote: r.bookedNote,
    bookedAt: r.bookedAt,
  }));
}
