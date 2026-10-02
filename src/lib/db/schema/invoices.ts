import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { projects } from './projects';
import { agencies } from './agencies';
import { clientUsers } from './users';

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  projectId: text('project_id').notNull().references(() => projects.id),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  clientId: text('client_id').notNull().references(() => clientUsers.id),
  title: text('title').notNull(),
  invoiceNumber: text('invoice_number'),
  notes: text('notes'),
  status: text('status', { enum: ['draft', 'sent', 'paid', 'overdue'] }).notNull().default('draft'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  totalAmount: integer('total_amount').notNull(),
  pdfR2Key: text('pdf_r2_key'),
  pdfGenerated: integer('pdf_generated', { mode: 'boolean' }).notNull().default(false),
  visibleToClient: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
  stripeCheckoutSessionId: text('stripe_checkout_session_id'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  // Dunning: 0 = none, 1 = Erinnerung, 2 = 1. Mahnung, 3 = 2. Mahnung.
  reminderLevel: integer('reminder_level').notNull().default(0),
  lastReminderAt: integer('last_reminder_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  invoiceId: text('invoice_id').notNull().references(() => invoices.id),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  taxRate: integer('tax_rate').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
