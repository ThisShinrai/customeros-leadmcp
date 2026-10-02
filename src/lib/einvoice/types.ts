/**
 * EN 16931 / ZUGFeRD 2.x (UN/CEFACT CII) e-invoice input types.
 *
 * These interfaces are the *neutral* shape the orchestrator maps DB rows onto
 * before handing them to `buildCiiXml`. They intentionally carry only the data
 * EN 16931 needs — no DB ids, no UI concerns.
 *
 * Money is always carried as integer NET cents to avoid float drift; the CII
 * builder does all rounding in integer-cent space and formats at the very end.
 */

/** A trade party (BG-4 seller / BG-7 buyer). */
export interface EInvoiceParty {
  /** Legal/trading name (BT-27 seller / BT-44 buyer). Required. */
  name: string;
  /** Street + number, single line (BT-35 / BT-50). */
  street?: string;
  /** Postcode (BT-38 / BT-53). */
  zip?: string;
  /** City (BT-37 / BT-52). */
  city?: string;
  /** ISO 3166-1 alpha-2 country code (BT-40 / BT-55), e.g. 'DE'. Required. */
  countryCode: string;
  /** USt-IdNr / VAT identifier (BT-31 seller / BT-48 buyer), schemeID "VA". */
  vatId?: string;
  /** Contact e-mail — not a mandatory EN 16931 field, carried for convenience. */
  email?: string;
}

/** A single invoice line (BG-25). */
export interface EInvoiceLine {
  /** Line identifier (BT-126), e.g. '1'. */
  id: string;
  /** Item name / description (BT-153). */
  name: string;
  /** Billed quantity (BT-129). Unit is assumed pieces (C62). */
  quantity: number;
  /** NET unit price in integer cents (BT-146, net price basis). */
  unitPriceCents: number;
  /** VAT rate in percent (BT-152), e.g. 19, 7 or 0. */
  taxRatePercent: number;
}

/** The complete invoice payload (BG-2 document level + lines). */
export interface EInvoiceData {
  /** Invoice number (BT-1). */
  invoiceNumber: string;
  /** Issue date (BT-2). */
  issueDate: Date;
  /** Payment due date (BT-9). Optional. */
  dueDate?: Date | null;
  /** ISO 4217 currency code (BT-5), e.g. 'EUR'. */
  currency: string;
  /** Free-text note (BT-22). Optional. */
  note?: string;
  /**
   * Seller (BG-4). `iban`/`bic` (BT-84 / BT-86) drive the SEPA credit-transfer
   * payment means; when `iban` is absent no payment-account block is emitted.
   */
  seller: EInvoiceParty & { iban?: string; bic?: string };
  /** Buyer (BG-7). */
  buyer: EInvoiceParty;
  /** Invoice lines (BG-25), at least one expected by EN 16931 (BR-16). */
  lines: EInvoiceLine[];
}
