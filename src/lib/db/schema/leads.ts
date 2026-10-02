import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';
import { agencies } from './agencies';

/**
 * Vertriebs-Leads (übernommen aus dem internen Sales Manager, tenant-scoped).
 * Ein Lead ist ein potenzieller Kunde vor der Umwandlung in einen client_user.
 * Status-Modell 1:1 aus dem Sales Manager — ohne Hotkey-/Anrufmodus-Ballast.
 */

export const LEAD_STATUSES = [
  'neu',
  'nicht_erreicht',
  'rueckruf',
  'termin_vereinbart',
  'angebot_offen',
  'bedenkzeit',
  'gewonnen',
  'verloren',
  'kein_interesse',
  'nicht_anrufen',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  agencyId: text('agency_id').notNull().references(() => agencies.id),
  company: text('company').notNull(),
  contactName: text('contact_name').notNull().default(''),
  /** Rolle/Position des Ansprechpartners (z. B. „Inhaber", „Geschäftsführerin"). */
  contactRole: text('contact_role').notNull().default(''),
  phone: text('phone').notNull().default(''),
  /** Zweite Nummer (Mobil, Zentrale …). */
  phoneAlt: text('phone_alt').notNull().default(''),
  email: text('email').notNull().default(''),
  /** Straße + Hausnummer (Ort separat in city). */
  address: text('address').notNull().default(''),
  city: text('city').notNull().default(''),
  /** Branche (z. B. „Bäckerei", „SHK-Betrieb"). */
  industry: text('industry').notNull().default(''),
  /** Google-Bewertung als Freitext (z. B. „4,6 ★ · 128 Rezensionen"). */
  googleRating: text('google_rating').notNull().default(''),
  websiteUrl: text('website_url').notNull().default(''),
  /** Social-Media-Profile, eine URL je Zeile. */
  socialLinks: text('social_links').notNull().default(''),
  /** Technik der bestehenden Website: CMS/Framework/Baukasten inkl. Version. */
  techStack: text('tech_stack').notNull().default(''),
  /** Alter/Stand der Website (z. B. „Copyright 2017, letzte Änderung ca. 2019"). */
  siteAge: text('site_age').notNull().default(''),
  /** Ersteller der bestehenden Website (Agentur/Person), falls erkennbar. */
  siteBuiltBy: text('site_built_by').notNull().default(''),
  /** Link zum Ersteller (Website/Impressum/Profil). */
  siteBuiltByUrl: text('site_built_by_url').notNull().default(''),
  source: text('source').notNull().default(''),
  /** Pain-Point-Liste aus der Recherche (Markdown/Aufzählung). */
  analysis: text('analysis').notNull().default(''),
  recommendation: text('recommendation').notNull().default(''),
  /** Preiseinschätzung aus der Recherche — Richtwert in Cents. */
  estimatedCents: integer('estimated_cents'),
  status: text('status', { enum: LEAD_STATUSES }).notNull().default('neu'),
  /** Stern-Markierung: besonders vielversprechender Lead. */
  starred: integer('starred', { mode: 'boolean' }).notNull().default(false),
  nextActionOn: integer('next_action_on', { mode: 'timestamp' }),
  doNotCall: integer('do_not_call', { mode: 'boolean' }).notNull().default(false),
  attempts: integer('attempts').notNull().default(0),
  /** agency_users.id des zuständigen Vertrieblers (optional). */
  assignedTo: text('assigned_to'),
  /** Gesetzt, sobald der Lead als Kunde übernommen wurde (client_users.id). */
  convertedClientId: text('converted_client_id'),
  /** Jüngster Website-Check als JSON ({ score, findings: [{label, ok, wert}] , … }). */
  siteCheck: text('site_check'),
  siteCheckedAt: integer('site_checked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

/** Notizen & Aktivitäten am Lead (Statuswechsel werden als Einträge geloggt). */
export const leadNotes = sqliteTable('lead_notes', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  leadId: text('lead_id').notNull().references(() => leads.id),
  authorName: text('author_name').notNull().default(''),
  note: text('note').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadNote = typeof leadNotes.$inferSelect;
