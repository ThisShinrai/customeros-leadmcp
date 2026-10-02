import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { projects } from './projects';

export const whiteboards = sqliteTable('whiteboards', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull().default('Whiteboard'),
  // Serialized Excalidraw scene (elements + files), as JSON text.
  scene: text('scene'),
  // Shared with the client (visible + joinable in the portal).
  sharedWithClient: integer('shared_with_client', { mode: 'boolean' }).notNull().default(false),
  // Optimistic-concurrency version, bumped on each save (drives poll-sync).
  version: integer('version').notNull().default(0),
  updatedBy: text('updated_by'),
  updatedByName: text('updated_by_name'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Whiteboard = typeof whiteboards.$inferSelect;
export type NewWhiteboard = typeof whiteboards.$inferInsert;
