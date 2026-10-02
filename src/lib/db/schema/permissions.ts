import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';
import { agencyUsers } from './users';

export const roles = sqliteTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const rolePermissions = sqliteTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id),
  permission: text('permission').notNull(),
});

export const userRoles = sqliteTable('user_roles', {
  userId: text('user_id').notNull().references(() => agencyUsers.id),
  roleId: text('role_id').notNull().references(() => roles.id),
  assignedAt: integer('assigned_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const userPermissions = sqliteTable('user_permissions', {
  userId: text('user_id').notNull().references(() => agencyUsers.id),
  permission: text('permission').notNull(),
  granted: integer('granted', { mode: 'boolean' }).notNull(),
});

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
export type UserPermission = typeof userPermissions.$inferSelect;
export type NewUserPermission = typeof userPermissions.$inferInsert;
