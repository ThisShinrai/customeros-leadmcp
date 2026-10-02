import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/** Outbound webhook endpoints: epssys POSTs signed JSON to the agency's URL on events. */
export const webhookEndpoints = sqliteTable('webhook_endpoints', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  /** JSON array of event keys, or ["*"] for all. */
  events: text('events'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
