/**
 * Permission system. MVP (Phase 1) uses the three predefined roles
 * (owner / admin / member) mapped to permission sets, with optional
 * per-user grant/revoke overrides (user_permissions table).
 * Custom roles with a granular matrix are Phase 2.
 */

export const PERMISSION_KEYS = [
  // Projekte
  'projects:view', 'projects:create', 'projects:edit', 'projects:delete', 'projects:archive',
  // Kunden
  'clients:view', 'clients:invite', 'clients:disable', 'clients:edit',
  // Chat
  'chat:view', 'chat:write', 'chat:manage',
  // Dateien
  'files:view', 'files:upload', 'files:delete', 'files:release',
  // Rechnungen
  'invoices:view', 'invoices:create', 'invoices:release', 'invoices:delete',
  // Leads (Vertrieb)
  'leads:view', 'leads:manage',
  // Team
  'team:invite', 'team:roles', 'team:remove',
  // Einstellungen
  'settings:profile', 'settings:whitelabel', 'settings:billing',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type AgencyRole = 'owner' | 'admin' | 'member';

const ALL: PermissionKey[] = [...PERMISSION_KEYS];

const MEMBER: PermissionKey[] = [
  'projects:view', 'projects:edit',
  'clients:view',
  'chat:view', 'chat:write',
  'files:view', 'files:upload',
  'invoices:view',
  'leads:view', 'leads:manage',
];

const ADMIN: PermissionKey[] = ALL.filter((p) => p !== 'settings:billing');

export const ROLE_PERMISSIONS: Record<AgencyRole, PermissionKey[]> = {
  owner: ALL,
  admin: ADMIN,
  member: MEMBER,
};

/** Human-facing labels for the predefined roles (German UI). */
export const ROLE_LABELS: Record<AgencyRole, string> = {
  owner: 'Inhaber',
  admin: 'Projektleiter',
  member: 'Mitarbeiter',
};

/** Permission area groupings for settings/role UIs. */
export const PERMISSION_GROUPS: { area: string; keys: PermissionKey[] }[] = [
  { area: 'Projekte', keys: ['projects:view', 'projects:create', 'projects:edit', 'projects:delete', 'projects:archive'] },
  { area: 'Kunden', keys: ['clients:view', 'clients:invite', 'clients:disable', 'clients:edit'] },
  { area: 'Chat', keys: ['chat:view', 'chat:write', 'chat:manage'] },
  { area: 'Dateien', keys: ['files:view', 'files:upload', 'files:delete', 'files:release'] },
  { area: 'Rechnungen', keys: ['invoices:view', 'invoices:create', 'invoices:release', 'invoices:delete'] },
  { area: 'Leads', keys: ['leads:view', 'leads:manage'] },
  { area: 'Team', keys: ['team:invite', 'team:roles', 'team:remove'] },
  { area: 'Einstellungen', keys: ['settings:profile', 'settings:whitelabel', 'settings:billing'] },
];
