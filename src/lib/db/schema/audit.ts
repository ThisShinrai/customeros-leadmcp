import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/**
 * Append-only audit trail. One row per security-/billing-relevant mutation
 * (invites, role changes, invoice send/paid, file release, white-label save).
 * Writes go through `logAudit` (lib/audit.ts), which never throws — auditing
 * must never break the underlying business logic.
 */
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  // Actor is nullable: some events may originate from the system / no session.
  actorId: text('actor_id'),
  actorName: text('actor_name'),
  // Dotted action name, e.g. 'client.invited', 'invoice.paid'.
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  // Free-form JSON string with extra context (kept small).
  meta: text('meta'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
