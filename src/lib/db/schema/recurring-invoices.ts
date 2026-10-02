import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { clientUsers } from './users';
import { projects } from './projects';

/**
 * Recurring / retainer invoice templates. A daily job materialises a real
 * invoice from the template when `nextRunAt` is due, then advances it by
 * `intervalMonths`. `items` is the same JSON shape as invoice line items.
 */
export const recurringInvoices = sqliteTable('recurring_invoices', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  clientId: text('client_id').notNull().references(() => clientUsers.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  notes: text('notes'),
  /** JSON: { description, quantity, unitPriceCents, taxRate }[] */
  items: text('items').notNull(),
  intervalMonths: integer('interval_months').notNull().default(1),
  nextRunAt: integer('next_run_at', { mode: 'timestamp' }).notNull(),
  /** Auto-release (make visible + notify) the generated invoice. */
  autoRelease: integer('auto_release', { mode: 'boolean' }).notNull().default(true),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastGeneratedAt: integer('last_generated_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type RecurringInvoice = typeof recurringInvoices.$inferSelect;
export type NewRecurringInvoice = typeof recurringInvoices.$inferInsert;
