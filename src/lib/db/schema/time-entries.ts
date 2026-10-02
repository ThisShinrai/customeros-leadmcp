import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { projects } from './projects';

/**
 * Billable time tracking. Entries are logged against a project; unbilled
 * billable entries can be bundled into an invoice (→ `invoiceId` is set).
 */
export const timeEntries = sqliteTable('time_entries', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull(),
  userName: text('user_name'),
  description: text('description').notNull(),
  minutes: integer('minutes').notNull(),
  occurredAt: integer('occurred_at', { mode: 'timestamp' }).notNull(),
  billable: integer('billable', { mode: 'boolean' }).notNull().default(true),
  /** Optional hourly rate in cents — used when billing the entry. */
  rateCents: integer('rate_cents'),
  /** Set once the entry has been billed into an invoice. */
  invoiceId: text('invoice_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type TimeEntry = typeof timeEntries.$inferSelect;
export type NewTimeEntry = typeof timeEntries.$inferInsert;
