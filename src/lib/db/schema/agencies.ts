import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { nanoid } from 'nanoid';

export const agencies = sqliteTable('agencies', {
  id: text('id').primaryKey().$defaultFn(() => nanoid()),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  accentColor: text('accent_color'),
  // Extended white-label palette.
  loginBgColor: text('login_bg_color'),
  portalAccentText: text('portal_accent_text'),
  contactEmail: text('contact_email'),
  phone: text('phone'),
  website: text('website'),
  address: text('address'),
  taxId: text('tax_id'),
  // E-Rechnung (EN 16931): structured legal address + SEPA payment details.
  iban: text('iban'),
  bic: text('bic'),
  street: text('street'),
  zip: text('zip'),
  city: text('city'),
  country: text('country'),
  customDomain: text('custom_domain'),
  // Support identity: human-readable customer number + a PIN the owner shares
  // with epssys support to authorize a censored support lookup.
  customerNumber: text('customer_number'),
  supportPin: text('support_pin'),
  onboardedAt: integer('onboarded_at', { mode: 'timestamp' }),
  // Paid add-on: hide in-app promos/ads for the whole team.
  teamAdsDisabled: integer('team_ads_disabled', { mode: 'boolean' }).notNull().default(false),
  plan: text('plan', { enum: ['free', 'starter', 'pro', 'business'] }).notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
