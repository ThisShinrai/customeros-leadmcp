import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/**
 * Agency-wide custom columns for the global tasks board — one shared board per
 * agency (e.g. "Zu erledigen", "In Arbeit", "In Review", "Erledigt"). Tasks
 * reference a column via tasks.taskColumnId. `isDone` marks a column whose
 * tasks count as completed (keeps the legacy status enum in sync).
 */
export const taskColumns = sqliteTable('task_columns', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  color: text('color').notNull().default('#909090'),
  sortOrder: integer('sort_order').notNull().default(0),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type TaskColumn = typeof taskColumns.$inferSelect;
export type NewTaskColumn = typeof taskColumns.$inferInsert;
