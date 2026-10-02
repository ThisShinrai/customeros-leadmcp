import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { projects } from './projects';

/** Nestable folders for project files (parentId is a self-reference; null = root). */
export const folders = sqliteTable('folders', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  parentId: text('parent_id'),
  /** Show this folder in the client portal even when empty. */
  visibleToClient: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
