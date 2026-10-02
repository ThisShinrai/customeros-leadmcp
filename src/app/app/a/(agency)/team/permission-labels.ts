import type { PermissionKey } from '@/lib/permissions';

/**
 * Readable German labels for every permission key (26 total).
 * Used by the custom-role editor matrix. The label is the action only —
 * the area name (e.g. "Projekte") comes from PERMISSION_GROUPS.area, so a
 * row reads "Projekte · Erstellen".
 */
export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  // Projekte
  'projects:view': 'Ansehen',
  'projects:create': 'Erstellen',
  'projects:edit': 'Bearbeiten',
  'projects:delete': 'Löschen',
  'projects:archive': 'Archivieren',
  // Kunden
  'clients:view': 'Ansehen',
  'clients:invite': 'Einladen',
  'clients:disable': 'Deaktivieren',
  'clients:edit': 'Bearbeiten',
  // Chat
  'chat:view': 'Ansehen',
  'chat:write': 'Schreiben',
  'chat:manage': 'Verwalten',
  // Dateien
  'files:view': 'Ansehen',
  'files:upload': 'Hochladen',
  'files:delete': 'Löschen',
  'files:release': 'Freigeben',
  // Rechnungen
  'invoices:view': 'Ansehen',
  'invoices:create': 'Erstellen',
  'invoices:release': 'Freigeben',
  'invoices:delete': 'Löschen',
  // Leads
  'leads:view': 'Ansehen',
  'leads:manage': 'Verwalten',
  // Team
  'team:invite': 'Einladen',
  'team:roles': 'Rollen verwalten',
  'team:remove': 'Entfernen',
  // Einstellungen
  'settings:profile': 'Profil',
  'settings:whitelabel': 'White-Label',
  'settings:billing': 'Abrechnung',
};

/** Optional short description shown under selected permission keys. */
export const PERMISSION_HINTS: Partial<Record<PermissionKey, string>> = {
  'team:roles': 'Rollen erstellen, bearbeiten und zuweisen',
  'files:release': 'Dateien für Kunden im Portal sichtbar machen',
  'invoices:release': 'Rechnungen für Kunden freischalten',
  'clients:disable': 'Portal-Zugang eines Kunden sperren',
  'settings:billing': 'Abonnement und Zahlungsdaten verwalten',
};

/** Full readable label including the area, e.g. "Projekte · Erstellen". */
export function fullPermissionLabel(area: string, key: PermissionKey): string {
  return `${area} · ${PERMISSION_LABELS[key]}`;
}
