import { ROLE_PERMISSIONS, type AgencyRole, type PermissionKey } from './constants';

export interface UserPermissionOverride {
  permission: string;
  granted: boolean;
}

/**
 * Effective permissions:
 *  - owner → everything (super-admin, never restricted)
 *  - else → union of the user's assigned custom roles' permissions
 *           (falls back to the base owner/admin/member set if the user has
 *           no custom roles assigned, for backwards compatibility)
 *  - then ± per-user grant/revoke overrides.
 */
export function computePermissions(
  role: AgencyRole,
  assignedRolePermissions: string[] = [],
  overrides: UserPermissionOverride[] = [],
): Set<PermissionKey> {
  let set: Set<PermissionKey>;
  if (role === 'owner') {
    set = new Set<PermissionKey>(ROLE_PERMISSIONS.owner);
  } else if (assignedRolePermissions.length > 0) {
    set = new Set<PermissionKey>(assignedRolePermissions as PermissionKey[]);
  } else {
    set = new Set<PermissionKey>(ROLE_PERMISSIONS[role] ?? []);
  }
  for (const o of overrides) {
    const key = o.permission as PermissionKey;
    if (o.granted) set.add(key);
    else set.delete(key);
  }
  return set;
}

export function hasPermission(permissions: Set<PermissionKey> | PermissionKey[], action: PermissionKey): boolean {
  const set = Array.isArray(permissions) ? new Set(permissions) : permissions;
  return set.has(action);
}

/** Throws FORBIDDEN if the permission is missing. Use server-side only. */
export function assertPermission(permissions: Set<PermissionKey> | PermissionKey[], action: PermissionKey): void {
  if (!hasPermission(permissions, action)) {
    throw new Error('FORBIDDEN');
  }
}
