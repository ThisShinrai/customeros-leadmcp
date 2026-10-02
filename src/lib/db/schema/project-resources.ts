import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { projects } from './projects';

/** Project resources / embeds — links (Figma, Loom, Google Docs, Calendly, …) the
 *  agency attaches to a project; the client sees them embedded in the portal. */
export const projectResources = sqliteTable('project_resources', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  url: text('url').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type ProjectResource = typeof projectResources.$inferSelect;
export type NewProjectResource = typeof projectResources.$inferInsert;
