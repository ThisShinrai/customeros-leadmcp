import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/** Web-Push subscriptions (one per browser/device per user). */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  userId: text('user_id').notNull(),
  userType: text('user_type', { enum: ['agency_user', 'client_user'] }).notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
