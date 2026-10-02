import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

export const agencyUsers = sqliteTable('agency_users', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  avatarFrameColor: text('avatar_frame_color'),
  bio: text('bio'),
  role: text('role', { enum: ['owner', 'admin', 'member'] }).notNull().default('member'),
  status: text('status', { enum: ['active', 'invited', 'inactive'] }).notNull().default('invited'),
  inviteToken: text('invite_token'),
  notificationsSeenAt: integer('notifications_seen_at', { mode: 'timestamp' }),
  emailFrequency: text('email_frequency', { enum: ['sofort', 'nie'] }).notNull().default('sofort'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const clientUsers = sqliteTable('client_users', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  email: text('email').notNull(),
  name: text('name').notNull(),
  company: text('company'),
  // E-Rechnung (EN 16931): buyer postal address + VAT ID.
  street: text('street'),
  zip: text('zip'),
  city: text('city'),
  country: text('country'),
  vatId: text('vat_id'),
  avatarUrl: text('avatar_url'),
  avatarFrameColor: text('avatar_frame_color'),
  portalEnabled: integer('portal_enabled', { mode: 'boolean' }).notNull().default(false),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  emailFrequency: text('email_frequency', { enum: ['sofort', 'nie'] }).notNull().default('sofort'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type AgencyUser = typeof agencyUsers.$inferSelect;
export type NewAgencyUser = typeof agencyUsers.$inferInsert;
export type ClientUser = typeof clientUsers.$inferSelect;
export type NewClientUser = typeof clientUsers.$inferInsert;
