import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { projects } from './projects';
import { agencies } from './agencies';

export const files = sqliteTable('files', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  projectId: text('project_id').notNull().references(() => projects.id),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  size: integer('size').notNull(),
  r2Key: text('r2_key').notNull(),
  mimeType: text('mime_type').notNull(),
  uploadedBy: text('uploaded_by').notNull(),
  uploaderType: text('uploader_type', { enum: ['agency_user', 'client_user'] }).notNull(),
  visibleToClient: integer('visible_to_client', { mode: 'boolean' }).notNull().default(false),
  folderId: text('folder_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
