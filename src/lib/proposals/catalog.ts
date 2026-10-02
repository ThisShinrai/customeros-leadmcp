/**
 * Leistungskatalog für den Angebots-Wizard. Preise sind Richtwerte in Cents —
 * im Wizard je Position anpassbar und über den Prozent-Regler global skalierbar.
 * Client-safe (keine Server-Imports).
 */

export interface CatalogService {
  key: string;
  label: string;
  description: string;
  basePriceCents: number;
  /** Einheit fürs Label; Positionen mit Menge > 1 sinnvoll (Seiten, Sprachen …). */
  unit?: string;
  qtyEnabled?: boolean;
}

export const LEISTUNGSKATALOG: CatalogService[] = [
  { key: 'onepager',     label: 'Website Onepager',                  description: 'Eine lange Scroll-Seite: Leistungen, Team, Kontakt — ideal für den Einstieg.', basePriceCents: 149000 },
  { key: 'website',      label: 'Website Business (bis 5 Seiten)',   description: 'Startseite + bis zu 4 Unterseiten, individuell gestaltet, responsive.', basePriceCents: 290000 },
  { key: 'unterseite',   label: 'Zusätzliche Unterseite',            description: 'Weitere Inhaltsseite über die 5 inklusiven hinaus.', basePriceCents: 24000, unit: 'je Seite', qtyEnabled: true },
  { key: 'shop',         label: 'Online-Shop',                       description: 'Produktkatalog, Warenkorb, Zahlung — inkl. Einrichtung.', basePriceCents: 490000 },
  { key: 'logo',         label: 'Logo & Branding',                   description: 'Logo, Farbwelt, Schriften — als Grundlage des Auftritts.', basePriceCents: 69000 },
  { key: 'texte',        label: 'Texterstellung',                    description: 'Professionelle Texte inkl. Lektorat.', basePriceCents: 14000, unit: 'je Seite', qtyEnabled: true },
  { key: 'seo',          label: 'SEO-Grundeinrichtung',              description: 'Meta-Daten, Struktur, Ladezeit, Search Console.', basePriceCents: 49000 },
  { key: 'gbp',          label: 'Google-Business-Profil',            description: 'Einrichtung/Optimierung des Google-Unternehmensprofils.', basePriceCents: 19000 },
  { key: 'fotos',        label: 'Bildauswahl & -aufbereitung',       description: 'Stock-/Bestandsbilder sichten, zuschneiden, optimieren.', basePriceCents: 18000 },
  { key: 'termin',       label: 'Online-Terminbuchung',              description: 'Buchungstool eingebunden und konfiguriert.', basePriceCents: 39000 },
  { key: 'social',       label: 'Social-Media-Buttons',              description: 'Icons/Verlinkung zu Instagram, Facebook, TikTok & Co. — inkl. Teilen-Funktion.', basePriceCents: 9000 },
  { key: 'mehrsprachig', label: 'Mehrsprachigkeit',                  description: 'Zusätzliche Sprachversion der Website.', basePriceCents: 35000, unit: 'je Sprache', qtyEnabled: true },
  { key: 'dsgvo',        label: 'Impressum & Datenschutz (DSGVO)',   description: 'Rechtstexte eingebunden, Cookie-Hinweis, Verzeichnisse.', basePriceCents: 15000 },
  { key: 'hosting',      label: 'Hosting & Domain-Einrichtung',      description: 'Domain, SSL, E-Mail-Postfächer, Go-Live.', basePriceCents: 12000 },
  { key: 'wartung',      label: 'Wartung & Pflege (1. Monat)',       description: 'Updates, Backups, kleine Änderungen — monatlich kündbar.', basePriceCents: 11500, unit: 'pro Monat' },
];
