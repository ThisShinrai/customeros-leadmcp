import { sqliteTable, text, integer, type AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { agencyUsers, clientUsers } from './users';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status', { enum: ['open', 'active', 'feedback', 'done', 'archived'] }).notNull().default('open'),
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  // Chat: when true, the project's client may message ALL agency users
  // (not just the assigned project members).
  chatBypass: integer('chat_bypass', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projectClients = sqliteTable('project_clients', {
  projectId: text('project_id').notNull().references(() => projects.id),
  clientId: text('client_id').notNull().references(() => clientUsers.id),
  addedAt: integer('added_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const projectMembers = sqliteTable('project_members', {
  projectId: text('project_id').notNull().references(() => projects.id),
  userId: text('user_id').notNull().references(() => agencyUsers.id),
  addedAt: integer('added_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Kanban board columns — fully customizable per project (name, color, order).
// `isDone` marks the "completed" column(s) for progress/% tracking.
export const boardColumns = sqliteTable('board_columns', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  projectId: text('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  color: text('color').notNull().default('#909090'),
  sortOrder: integer('sort_order').notNull().default(0),
  isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  projectId: text('project_id').notNull().references(() => projects.id),
  title: text('title').notNull(),
  status: text('status', { enum: ['open', 'active', 'done'] }).notNull().default('open'),
  description: text('description'),
  priority: text('priority', { enum: ['none', 'low', 'medium', 'high', 'urgent'] }).notNull().default('none'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  assigneeId: text('assignee_id').references(() => agencyUsers.id),
  // Which per-project Kanban column the task lives in (null until the board is seeded).
  columnId: text('column_id').references(() => boardColumns.id),
  // Agency-wide tasks board: custom column + order within it (loose FK to task_columns).
  taskColumnId: text('task_column_id'),
  boardSort: integer('board_sort').notNull().default(0),
  // Subtasks: a task may be the child of another task (same project).
  parentId: text('parent_id').references((): AnySQLiteColumn => tasks.id),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectClient = typeof projectClients.$inferSelect;
export type NewProjectClient = typeof projectClients.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskPriority = Task['priority'];
export type BoardColumn = typeof boardColumns.$inferSelect;
export type NewBoardColumn = typeof boardColumns.$inferInsert;
