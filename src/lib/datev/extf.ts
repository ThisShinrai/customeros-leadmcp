/**
 * DATEV "Buchungsstapel" (EXTF) CSV generator.
 *
 * Produces the standard DATEV-Format ASCII import file ("Buchungsstapel") that a
 * Steuerberater imports into DATEV Kanzlei-Rechnungswesen / Unternehmen online:
 *
 *   Line 1  — Kopfzeile (EXTF metadata record, 31 semicolon-separated fields)
 *   Line 2  — Ueberschriften (the official Buchungsstapel column captions)
 *   Line 3+ — one booking row per invoice, aligned to the caption columns
 *
 * Format values used (verified, see sources below):
 *   Kennzeichen     EXTF   (export from a third-party application)
 *   Versionsnummer  700
 *   Datenkategorie  21     (Buchungsstapel)
 *   Formatname      Buchungsstapel
 *   Formatversion   13
 *   Sachkontenlaenge 4
 *   Buchungstyp     1      (Finanzbuchfuehrung)
 *   Festschreibung  0      (nicht festgeschrieben — in DATEV noch korrigierbar)
 *   WKZ             EUR
 *
 * Design constraints (Cloudflare Workers / edge runtime):
 *   - Pure string building, no Node APIs (no fs / no Buffer), no dependencies.
 *   - Deterministic and side-effect free — same input ⇒ byte-identical output.
 *   - Money math in integer cents; formatted to exactly 2 decimals at the leaf.
 *
 * Encoding note:
 *   DATEV imports the file as Windows-1252 (CP-1252). We return a JS string, so
 *   the calling download route is responsible for the byte encoding — it should
 *   serve `Content-Type: text/csv; charset=windows-1252` and transcode the
 *   string to CP-1252 (e.g. via a small ASCII-superset mapping). To stay safe we
 *   keep all *generated* literals within Latin-1 and only let caller-supplied
 *   free text through the sanitizer; characters outside CP-1252 in that text
 *   should be replaced by the route before download.
 *
 * Header layout and column captions verified against:
 *   - ledermann/datev  examples/EXTF_Buchungsstapel.csv  (version 700, format 13)
 *   - ledermann/datev  lib/datev/base/header.rb           (31-field header order)
 *   - DATEV Developer Portal — "DATEV-Format / Header" & "Buchungsstapel"
 *     (Buchungstyp 1=Finanzbuchfuehrung, Festschreibung 0=kein Lock, WKZ=EUR).
 */

import type { DatevBooking, DatevMeta } from './types';

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

const DELIMITER = ';';
const NEWLINE = '\r\n'; // DATEV files use CRLF line endings.

const KENNZEICHEN = 'EXTF';
const VERSIONSNUMMER = '700';
const DATENKATEGORIE = '21';
const FORMATNAME = 'Buchungsstapel';
const FORMATVERSION = '13';
const SACHKONTENLAENGE = '4';
const BUCHUNGSTYP = '1'; // Finanzbuchfuehrung
const RECHNUNGSLEGUNGSZWECK = '0'; // unabhaengig vom Rechnungslegungszweck
const FESTSCHREIBUNG = '0'; // 0 = nicht festgeschrieben
const WKZ = 'EUR';

/** Field-length limits enforced by the DATEV ASCII import. */
const LIMIT_BELEGFELD1 = 36;
const LIMIT_BUCHUNGSTEXT = 60;
const LIMIT_BEZEICHNUNG = 30;
const LIMIT_BERATER = 7;
const LIMIT_MANDANT = 5;
const LIMIT_BUKEY = 2;

/**
 * Official Buchungsstapel column captions (format version 13), in the exact
 * order DATEV expects. Taken verbatim from the canonical example file. Every
 * booking row MUST contain exactly this many fields — unused columns are empty.
 *
 * Note: the captions use the EN DASH "–" (as DATEV does) in
 * "Beleginfo – Art 1" etc. This codepoint is within CP-1252 (0x96).
 */
const COLUMN_CAPTIONS: readonly string[] = [
  'Umsatz (ohne Soll/Haben-Kz)',
  'Soll/Haben-Kennzeichen',
  'WKZ Umsatz',
  'Kurs',
  'Basisumsatz',
  'WKZ Basisumsatz',
  'Konto',
  'Gegenkonto (ohne BU-Schlüssel)',
  'BU-Schlüssel',
  'Belegdatum',
  'Belegfeld 1',
  'Belegfeld 2',
  'Skonto',
  'Buchungstext',
  'Postensperre',
  'Diverse Adressnummer',
  'Geschäftspartnerbank',
  'Sachverhalt',
  'Zinssperre',
  'Beleglink',
  'Beleginfo – Art 1',
  'Beleginfo – Inhalt 1',
  'Beleginfo – Art 2',
  'Beleginfo – Inhalt 2',
  'Beleginfo – Art 3',
  'Beleginfo – Inhalt 3',
  'Beleginfo – Art 4',
  'Beleginfo – Inhalt 4',
  'Beleginfo – Art 5',
  'Beleginfo – Inhalt 5',
  'Beleginfo – Art 6',
  'Beleginfo – Inhalt 6',
  'Beleginfo – Art 7',
  'Beleginfo – Inhalt 7',
  'Beleginfo – Art 8',
  'Beleginfo – Inhalt 8',
  'KOST1 – Kostenstelle',
  'KOST2 – Kostenstelle',
  'Kost Menge',
  'EU-Land u. USt-IdNr.',
  'EU-Steuersatz',
  'Abw. Versteuerungsart',
  'Sachverhalt L+L',
  'Funktionsergänzung L+L',
  'BU 49 Hauptfunktionstyp',
  'BU 49 Hauptfunktionsnummer',
  'BU 49 Funktionsergänzung',
  'Zusatzinformation – Art 1',
  'Zusatzinformation – Inhalt 1',
  'Zusatzinformation – Art 2',
  'Zusatzinformation – Inhalt 2',
  'Zusatzinformation – Art 3',
  'Zusatzinformation – Inhalt 3',
  'Zusatzinformation – Art 4',
  'Zusatzinformation – Inhalt 4',
  'Zusatzinformation – Art 5',
  'Zusatzinformation – Inhalt 5',
  'Zusatzinformation – Art 6',
  'Zusatzinformation – Inhalt 6',
  'Zusatzinformation – Art 7',
  'Zusatzinformation – Inhalt 7',
  'Zusatzinformation – Art 8',
  'Zusatzinformation – Inhalt 8',
  'Zusatzinformation – Art 9',
  'Zusatzinformation – Inhalt 9',
  'Zusatzinformation – Art 10',
  'Zusatzinformation – Inhalt 10',
  'Zusatzinformation – Art 11',
  'Zusatzinformation – Inhalt 11',
  'Zusatzinformation – Art 12',
  'Zusatzinformation – Inhalt 12',
  'Zusatzinformation – Art 13',
  'Zusatzinformation – Inhalt 13',
  'Zusatzinformation – Art 14',
  'Zusatzinformation – Inhalt 14',
  'Zusatzinformation – Art 15',
  'Zusatzinformation – Inhalt 15',
  'Zusatzinformation – Art 16',
  'Zusatzinformation – Inhalt 16',
  'Zusatzinformation – Art 17',
  'Zusatzinformation – Inhalt 17',
  'Zusatzinformation – Art 18',
  'Zusatzinformation – Inhalt 18',
  'Zusatzinformation – Art 19',
  'Zusatzinformation – Inhalt 19',
  'Zusatzinformation – Art 20',
  'Zusatzinformation – Inhalt 20',
  'Stück',
  'Gewicht',
  'Zahlweise',
  'Forderungsart',
  'Veranlagungsjahr',
  'Zugeordnete Fälligkeit',
  'Skontotyp',
  'Auftragsnummer',
  'Buchungstyp',
  'USt-Schlüssel (Anzahlungen)',
  'EU-Mitgliedstaat (Anzahlungen)',
  'Sachverhalt L+L (Anzahlungen)',
  'EU-Steuersatz (Anzahlungen)',
  'Erlöskonto (Anzahlungen)',
  'Herkunft-Kz',
  'Leerfeld',
  'KOST-Datum',
  'SEPA-Mandatsreferenz',
  'Skontosperre',
  'Gesellschaftername',
  'Beteiligtennummer',
  'Identifikationsnummer',
  'Zeichnernummer',
  'Postensperre bis',
  'Bezeichnung',
  'Kennzeichen',
  'Festschreibung',
  'Leistungsdatum',
  'Datum Zuord.',
  'Fälligkeit',
  'Generalumkehr',
  'Steuersatz',
  'Land',
  'Abrechnungsreferent',
  'BVV-Position',
  'EU-Mitgliedstaat u. UStID (Ursprung)',
  'EU-Steuersatz (Ursprung)',
  'Abw. Skontokonto',
];

/** Number of columns in a booking row (kept in sync with the captions). */
const COLUMN_COUNT = COLUMN_CAPTIONS.length;

/** Zero-based positions of the columns we populate. */
const COL = {
  umsatz: 0,
  sollHaben: 1,
  wkzUmsatz: 2,
  konto: 6,
  gegenkonto: 7,
  buKey: 8,
  belegdatum: 9,
  belegfeld1: 10,
  buchungstext: 13,
} as const;

/* ------------------------------------------------------------------ *
 * Formatting primitives
 * ------------------------------------------------------------------ */

/**
 * Format integer cents as a DATEV German decimal: thousands are NOT grouped,
 * the decimal separator is a comma, always exactly two fraction digits.
 *   178500 -> "1785,00"   ·   5 -> "0,05"   ·   -42 -> "0,42" (sign dropped)
 * The sign is intentionally dropped — direction is carried by Soll/Haben.
 */
export function formatDatevAmount(cents: number): string {
  const n = Math.abs(Math.trunc(cents));
  const euros = Math.trunc(n / 100);
  const frac = n % 100;
  return `${euros},${frac.toString().padStart(2, '0')}`;
}

/**
 * DATEV Belegdatum: day + month only, zero-padded, no separator -> "DDMM".
 * The year is implied by the header's Wirtschaftsjahr / date range.
 *   2026-03-09 -> "0903"
 */
export function formatDatevBelegdatum(date: Date): string {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}${mm}`;
}

/** Header date as "YYYYMMDD". */
function formatYmd(date: Date): string {
  const yyyy = date.getFullYear().toString().padStart(4, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** "Erzeugt am" timestamp: "YYYYMMDDHHMMSSFFF" (17 digits, millisecond resolution). */
function formatTimestamp(date: Date): string {
  const fff = date.getMilliseconds().toString().padStart(3, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const mi = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${formatYmd(date)}${hh}${mi}${ss}${fff}`;
}

/**
 * Strip everything that would break a DATEV field: the semicolon delimiter, the
 * double-quote text qualifier, CR/LF, and other control characters. Collapses
 * runs of whitespace and trims. Optionally hard-truncates to `max` characters.
 *
 * Uses explicit `\u` escapes for the control-character class so the source file
 * stays pure ASCII (no embedded control bytes).
 */
function sanitizeText(value: string, max?: number): string {
  let out = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ') // C0 controls (CR/LF/TAB) + DEL
    .replace(/[;"]/g, ' ') // delimiter & text qualifier
    .replace(/\s+/g, ' ')
    .trim();
  if (max !== undefined && out.length > max) out = out.slice(0, max);
  return out;
}

/** Keep digits only (for account / number fields), truncate to `max`. */
function sanitizeNumeric(value: string, max?: number): string {
  let out = value.replace(/\D/g, '');
  if (max !== undefined && out.length > max) out = out.slice(0, max);
  return out;
}

/**
 * CSV-escape a value for a DATEV field. DATEV quotes text/alphanumeric fields
 * with double quotes; numeric fields stay bare. Because `sanitizeText` already
 * removed semicolons, quotes and newlines, escaping reduces to wrapping in
 * quotes — but we still double any residual quote defensively.
 */
function quote(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/* ------------------------------------------------------------------ *
 * Header (Kopfzeile) — 31 fields
 * ------------------------------------------------------------------ */

function buildHeaderLine(meta: DatevMeta, generatedAt: Date): string {
  const berater = sanitizeNumeric(meta.beraterNr ?? '', LIMIT_BERATER);
  const mandant = sanitizeNumeric(meta.mandantNr ?? '', LIMIT_MANDANT);
  const bezeichnung = sanitizeText(meta.name ?? '', LIMIT_BEZEICHNUNG);

  // Index matches ledermann/datev header order (1-based comment, 0-based array).
  const fields: string[] = [
    quote(KENNZEICHEN), //  1 DATEV-Format-Kennzeichen
    VERSIONSNUMMER, //      2 Versionsnummer
    DATENKATEGORIE, //      3 Datenkategorie (21 = Buchungsstapel)
    quote(FORMATNAME), //   4 Formatname
    FORMATVERSION, //       5 Formatversion
    formatTimestamp(generatedAt), // 6 Erzeugt am (YYYYMMDDHHMMSSFFF)
    '', //                  7 Importiert (immer leer beim Export)
    quote('CO'), //         8 Herkunft (2-stelliges Anwendungskuerzel)
    quote('CustomerOS'), // 9 Exportiert von (max 25)
    '', //                 10 Importiert von (immer leer beim Export)
    berater, //            11 Berater
    mandant, //            12 Mandant
    formatYmd(meta.fiscalYearStart), // 13 WJ-Beginn (YYYYMMDD)
    SACHKONTENLAENGE, //   14 Sachkontenlaenge
    formatYmd(meta.from), // 15 Datum von (YYYYMMDD)
    formatYmd(meta.to), //  16 Datum bis (YYYYMMDD)
    quote(bezeichnung), // 17 Bezeichnung
    '', //                 18 Diktatkuerzel
    BUCHUNGSTYP, //        19 Buchungstyp (1 = Finanzbuchfuehrung)
    RECHNUNGSLEGUNGSZWECK, // 20 Rechnungslegungszweck
    FESTSCHREIBUNG, //     21 Festschreibung (0 = nicht festgeschrieben)
    quote(WKZ), //         22 WKZ (Default-Waehrung EUR)
    '', //                 23 reserviert
    '', //                 24 Derivatskennzeichen
    '', //                 25 reserviert
    '', //                 26 reserviert
    '', //                 27 SKR
    '', //                 28 Branchenloesung-Id
    '', //                 29 reserviert
    '', //                 30 reserviert
    '', //                 31 Anwendungsinformation
  ];

  return fields.join(DELIMITER);
}

/* ------------------------------------------------------------------ *
 * Booking rows
 * ------------------------------------------------------------------ */

function buildBookingRow(b: DatevBooking): string {
  const cols = new Array<string>(COLUMN_COUNT).fill('');

  cols[COL.umsatz] = formatDatevAmount(b.grossCents); // bare numeric, comma decimal
  cols[COL.sollHaben] = quote('S'); // Soll — outgoing invoice posts the gross to the Debitor (Soll)
  cols[COL.wkzUmsatz] = quote(WKZ);
  cols[COL.konto] = sanitizeNumeric(b.account);
  cols[COL.gegenkonto] = sanitizeNumeric(b.counterAccount);
  cols[COL.buKey] = quote(sanitizeNumeric(b.buKey ?? '', LIMIT_BUKEY));
  cols[COL.belegdatum] = formatDatevBelegdatum(b.date); // bare DDMM
  cols[COL.belegfeld1] = quote(sanitizeText(b.invoiceNumber, LIMIT_BELEGFELD1));
  cols[COL.buchungstext] = quote(sanitizeText(b.text, LIMIT_BUCHUNGSTEXT));

  return cols.join(DELIMITER);
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Build a complete DATEV EXTF "Buchungsstapel" CSV string from the given
 * bookings and stapel metadata. Pure & deterministic except for the
 * "Erzeugt am" timestamp, which defaults to `new Date()` but can be injected
 * for reproducible output (testing).
 */
export function buildDatevExtf(
  bookings: DatevBooking[],
  meta: DatevMeta,
  generatedAt: Date = new Date(),
): string {
  const lines: string[] = [];
  lines.push(buildHeaderLine(meta, generatedAt));
  lines.push(COLUMN_CAPTIONS.join(DELIMITER));
  for (const b of bookings) lines.push(buildBookingRow(b));
  // Trailing newline: DATEV tolerates it and most exporters emit one.
  return lines.join(NEWLINE) + NEWLINE;
}

/**
 * Canonical download filename for a stapel:
 *   DATEV-Buchungsstapel-<von YYYYMMDD>-<bis YYYYMMDD>.csv
 */
export function datevFilename(meta: DatevMeta): string {
  return `DATEV-Buchungsstapel-${formatYmd(meta.from)}-${formatYmd(meta.to)}.csv`;
}
