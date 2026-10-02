import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { clientUsers } from './users';

/**
 * Angebote (proposals/quotes) with a simple electronic signature: the client
 * reviews in the portal and accepts by typing their name + consent (signer name,
 * timestamp, IP captured for audit). A signed proposal can be converted to an invoice.
 */
export const proposals = sqliteTable('proposals', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  projectId: text('project_id'),
  clientId: text('client_id').notNull().references(() => clientUsers.id),
  number: text('number'),
  title: text('title').notNull(),
  intro: text('intro'),
  status: text('status', { enum: ['draft', 'sent', 'viewed', 'signed', 'declined'] }).notNull().default('draft'),
  totalAmount: integer('total_amount').notNull().default(0),
  validUntil: integer('valid_until', { mode: 'timestamp' }),
  sentAt: integer('sent_at', { mode: 'timestamp' }),
  viewedAt: integer('viewed_at', { mode: 'timestamp' }),
  signedAt: integer('signed_at', { mode: 'timestamp' }),
  declinedAt: integer('declined_at', { mode: 'timestamp' }),
  signerName: text('signer_name'),
  signerIp: text('signer_ip'),
  convertedInvoiceId: text('converted_invoice_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const proposalItems = sqliteTable('proposal_items', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  proposalId: text('proposal_id').notNull().references(() => proposals.id),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  taxRate: integer('tax_rate').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
});

export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalItem = typeof proposalItems.$inferSelect;
export type NewProposalItem = typeof proposalItems.$inferInsert;
