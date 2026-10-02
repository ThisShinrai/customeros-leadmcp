import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { clientUsers } from './users';
import { projects } from './projects';

/**
 * Bookable appointment slots. The agency publishes `available` slots; a client
 * books one from their portal (→ `booked`, with bookedClientId). Times are
 * stored as UTC timestamps (the client builds them from its local Berlin time).
 */
export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  status: text('status', { enum: ['available', 'booked', 'cancelled'] }).notNull().default('available'),
  startAt: integer('start_at', { mode: 'timestamp' }).notNull(),
  endAt: integer('end_at', { mode: 'timestamp' }).notNull(),
  projectId: text('project_id').references(() => projects.id),
  bookedClientId: text('booked_client_id').references(() => clientUsers.id),
  bookedAt: integer('booked_at', { mode: 'timestamp' }),
  bookedNote: text('booked_note'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
