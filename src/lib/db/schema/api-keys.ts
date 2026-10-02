import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/** Agency API keys for the public REST API. Only the SHA-256 hash is stored;
 *  the raw key (eps_live_…) is shown to the user exactly once at creation. */
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  keyHash: text('key_hash').notNull(),
  prefix: text('prefix').notNull(),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
