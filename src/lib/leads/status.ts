import type { LeadStatus } from '@/lib/db/schema/leads';

/** Anzeige-Metadaten je Lead-Status — client-safe (keine Server-Imports). */
export const LEAD_STATUS_META: Record<LeadStatus, { label: string; fg: string; bg: string }> = {
  neu:               { label: 'Neu',                fg: '#1D4ED8', bg: '#DBEAFE' },
  nicht_erreicht:    { label: 'Nicht erreicht',     fg: '#6B7280', bg: '#F3F4F6' },
  rueckruf:          { label: 'Rückruf',            fg: '#B45309', bg: '#FEF3C7' },
  termin_vereinbart: { label: 'Termin vereinbart',  fg: '#7C3AED', bg: '#EDE9FE' },
  angebot_offen:     { label: 'Angebot offen',      fg: '#0369A1', bg: '#E0F2FE' },
  bedenkzeit:        { label: 'Bedenkzeit',         fg: '#A16207', bg: '#FEF9C3' },
  gewonnen:          { label: 'Gewonnen',           fg: '#15803D', bg: '#DCFCE7' },
  verloren:          { label: 'Verloren',           fg: '#DC2626', bg: '#FEE2E2' },
  kein_interesse:    { label: 'Kein Interesse',     fg: '#9F1239', bg: '#FFE4E6' },
  nicht_anrufen:     { label: 'Nicht anrufen',      fg: '#991B1B', bg: '#FEE2E2' },
};

/** Reihenfolge für Filter-Chips und Status-Auswahl. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  'neu', 'nicht_erreicht', 'rueckruf', 'termin_vereinbart', 'angebot_offen',
  'bedenkzeit', 'gewonnen', 'verloren', 'kein_interesse', 'nicht_anrufen',
];
