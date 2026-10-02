/** Support contact-form departments — shared between the client form and the
 *  server action (plain module so a client component can import the labels). */

export const DEPARTMENT_IDS = ['general', 'technical', 'billing', 'account'] as const;
export type SupportDepartment = (typeof DEPARTMENT_IDS)[number];

export const SUPPORT_DEPARTMENTS: { id: SupportDepartment; label: string; desc: string }[] = [
  { id: 'general', label: 'Allgemein', desc: 'Allgemeine Fragen & Anliegen' },
  { id: 'technical', label: 'Technik / IT', desc: 'Bug, Fehler, etwas geht nicht' },
  { id: 'billing', label: 'Buchhaltung', desc: 'Rechnungen & Zahlungen' },
  { id: 'account', label: 'Abo & Account', desc: 'Plan, Kündigung, Datenexport' },
];

export const DEPARTMENT_LABELS: Record<SupportDepartment, string> = {
  general: 'Allgemein',
  technical: 'Technik / IT',
  billing: 'Buchhaltung',
  account: 'Abo & Account',
};
