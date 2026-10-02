/**
 * Input types for the DATEV "Buchungsstapel" (EXTF) CSV export.
 *
 * These interfaces are the *neutral* shape the orchestrator maps DB rows
 * (invoices) onto before handing them to `buildDatevExtf`. They carry only the
 * data the DATEV ASCII import needs — no DB ids, no UI concerns.
 *
 * Accounting model (German double-entry / SKR):
 *   Each invoice becomes ONE booking row. The gross amount (incl. VAT) is
 *   posted Soll ("S") on the customer's Debitor account (`account`, e.g. 10000)
 *   against the revenue account ("Erlöskonto", `counterAccount`, e.g. 8400 in
 *   SKR03 / 4400 in SKR04) as Gegenkonto. The VAT is split out automatically by
 *   DATEV on import via the BU-Schlüssel (Steuerschlüssel) — the caller does NOT
 *   pre-compute the net/VAT split here; DATEV derives it from `grossCents` +
 *   `buKey`. That is the whole point of the automatic tax key.
 *
 * Money is integer cents everywhere to avoid IEEE-754 drift; it is formatted to
 * exactly two decimals (German comma) only at the leaf in `extf.ts`.
 */

export interface DatevBooking {
  /**
   * Belegdatum — the invoice date. Only day+month are emitted into the row
   * ("DDMM"); the year is carried by the header date range / Wirtschaftsjahr.
   * Therefore every booking in one stapel MUST fall inside the header's
   * [from, to] window of the SAME calendar year (see `DatevMeta`).
   */
  date: Date;

  /**
   * Belegfeld 1 — the invoice number. DATEV restricts this to 36 characters and
   * forbids the field delimiter; it is sanitized (semicolons/newlines stripped,
   * truncated to 36) before output.
   */
  invoiceNumber: string;

  /**
   * Umsatz — gross amount *including* VAT, as a positive integer number of
   * cents. Must be > 0. Emitted as a German decimal ("1785,00"). The sign is
   * never written here; direction is expressed by the Soll/Haben-Kennzeichen.
   */
  grossCents: number;

  /**
   * Konto — the account this amount is posted to. For an outgoing invoice this
   * is the Debitor (customer) account, e.g. "10000". Numeric string; its length
   * must be consistent with the Sachkontenlänge (4) declared in the header
   * (personal/Debitor accounts may be exactly one digit longer, i.e. 5 digits).
   */
  account: string;

  /**
   * Gegenkonto (ohne BU-Schlüssel) — the contra account, i.e. the revenue
   * account ("Erlöskonto"), e.g. "8400" (SKR03) or "4400" (SKR04).
   */
  counterAccount: string;

  /**
   * BU-Schlüssel / Steuerschlüssel (Buchungsschlüssel) — optional automatic tax
   * key prefixed to the Gegenkonto. Examples (SKR03): "" = no automatic tax,
   * "3" = 19 % Umsatzsteuer, "2" = 7 %, "9" = 19 % (Erlöse/Aufteilung context).
   * Conventions depend on the chart of accounts and the Steuerberater — the
   * caller supplies the correct value. Sanitized to digits, max 2 chars.
   */
  buKey?: string;

  /**
   * Buchungstext — free-text label for the booking, e.g. "Rechnung 2026-0042
   * Mustermann GmbH". DATEV limits this to 60 characters; it is sanitized
   * (semicolons/newlines stripped) and truncated before output.
   */
  text: string;
}

export interface DatevMeta {
  /**
   * Berater-Nr — DATEV consultant number (the Steuerberater's number). DATEV
   * expects a value >= 1001 for a *real* import; for an unassigned export we
   * leave it empty. Numeric string, max 7 digits.
   */
  beraterNr?: string;

  /**
   * Mandanten-Nr — DATEV client number assigned by the Steuerberater. Numeric
   * string, max 5 digits. Empty if not yet known.
   */
  mandantNr?: string;

  /**
   * Wirtschaftsjahresbeginn — start of the fiscal year (header field 13,
   * emitted as "YYYYMMDD"). Usually 1 January of the booking year.
   */
  fiscalYearStart: Date;

  /** Datum von — inclusive start of the booking-period covered by this stapel. */
  from: Date;

  /** Datum bis — inclusive end of the booking-period covered by this stapel. */
  to: Date;

  /**
   * Bezeichnung — human-readable label for the stapel (header field 17, max 30
   * chars), e.g. the agency name or "Ausgangsrechnungen Q1".
   */
  name?: string;
}
