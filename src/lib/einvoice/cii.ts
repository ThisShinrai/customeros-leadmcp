/**
 * EN 16931 / ZUGFeRD 2.x Cross-Industry-Invoice (CII) XML generator.
 *
 * Produces a UN/CEFACT `rsm:CrossIndustryInvoice` document — the XML syntax
 * ZUGFeRD embeds in the PDF/A-3 and the syntax German B2B e-invoicing
 * (XRechnung / ZUGFeRD) is built on. The output validates against the
 * EN 16931 profile (`urn:cen.eu:en16931:2017`).
 *
 * Design constraints (Cloudflare Workers / edge runtime):
 *   - Pure string building, no DOM / no XML lib, no Node APIs (no fs/Buffer).
 *   - Deterministic and side-effect free — same input ⇒ byte-identical output.
 *   - All money math is done in integer cents, formatted to exactly 2 decimals
 *     only at the leaves, to avoid IEEE-754 drift.
 *
 * Element ordering follows the UN/CEFACT D16B CII schema sequence and is
 * verified against two authoritative samples:
 *   - ZUGFeRD/corpus  XML-Rechnung/CII/EN16931_Einfach.cii.xml
 *   - ConnectingEurope/eInvoicing-EN16931  cii/examples/CII_business_example_01.xml
 */

import type { EInvoiceData, EInvoiceLine } from './types';

/* ------------------------------------------------------------------ *
 * Namespaces / profile
 * ------------------------------------------------------------------ */

const NS = {
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
} as const;

/**
 * EN 16931 (core, syntax-binding-neutral) guideline URN — the profile most
 * widely accepted across the EU and the lowest-common-denominator for German
 * B2B. For the stricter German national CIUS, swap this for the XRechnung URN:
 *   'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0'
 */
const PROFILE_EN16931 = 'urn:cen.eu:en16931:2017';

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/** XML-escape a text value for use in element content or an attribute value. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format integer cents as a fixed 2-decimal string with a '.' separator.
 * 12345 → "123.45", -5 → "-0.05", 0 → "0.00". Pure integer arithmetic — no
 * `toFixed`, no division on the value itself, so there is zero float drift.
 */
function money(cents: number): string {
  const n = Math.round(cents);
  const neg = n < 0;
  const abs = Math.abs(n);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${neg ? '-' : ''}${whole}.${frac < 10 ? '0' : ''}${frac}`;
}

/**
 * Format a VAT percentage with exactly 2 decimals (EN 16931 expects a decimal,
 * e.g. "19.00"). Input is a plain number like 19 or 7.5. Kept tolerant of one
 * fractional digit while staying deterministic.
 */
function percent(rate: number): string {
  return money(Math.round(rate * 100));
}

/** Date → "YYYYMMDD" (UN/CEFACT format qualifier "102"), in UTC. */
function dateYmd(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}${m}${day}`;
}

/* ------------------------------------------------------------------ *
 * Money / tax aggregation (integer-cent, mirrors lib/invoices/format.ts)
 * ------------------------------------------------------------------ */

interface LineComputed {
  line: EInvoiceLine;
  /** net unit × quantity, rounded to cents */
  lineNetCents: number;
}

interface TaxGroup {
  ratePercent: number;
  /** 'S' standard-rated, 'Z' zero-rated */
  categoryCode: 'S' | 'Z';
  basisCents: number;
  taxCents: number;
}

interface Totals {
  lines: LineComputed[];
  groups: TaxGroup[];
  lineTotalCents: number;
  taxTotalCents: number;
  grandTotalCents: number;
}

/**
 * Compute line nets and per-rate tax groups.
 *
 * Algorithm (must match the PDF/on-screen totals in lib/invoices/format.ts):
 *   1. lineNet   = round(unitNet × qty)               — per line, to cents
 *   2. basis(r)  = Σ lineNet over all lines at rate r  — exact cent sum
 *   3. tax(r)    = round(basis(r) × r / 100)           — once per rate group
 *   4. taxTotal  = Σ tax(r);  grand = lineTotal + taxTotal
 *
 * Rounding the tax once per rate group (not per line) is what EN 16931
 * BR-CO-17 requires: VAT category tax = round(category basis × rate).
 * A 0% rate maps to CategoryCode 'Z' (zero-rated), any positive rate to 'S'.
 */
function computeTotals(data: EInvoiceData): Totals {
  const lines: LineComputed[] = data.lines.map((line) => ({
    line,
    lineNetCents: Math.round(line.unitPriceCents * line.quantity),
  }));

  // Group net basis per distinct rate, preserving first-seen order.
  const order: number[] = [];
  const basisByRate = new Map<number, number>();
  for (const { line, lineNetCents } of lines) {
    const r = line.taxRatePercent;
    if (!basisByRate.has(r)) {
      basisByRate.set(r, 0);
      order.push(r);
    }
    basisByRate.set(r, basisByRate.get(r)! + lineNetCents);
  }

  const groups: TaxGroup[] = order.map((rate) => {
    const basisCents = basisByRate.get(rate)!;
    const taxCents = Math.round((basisCents * rate) / 100);
    return {
      ratePercent: rate,
      categoryCode: rate === 0 ? 'Z' : 'S',
      basisCents,
      taxCents,
    };
  });

  const lineTotalCents = lines.reduce((s, l) => s + l.lineNetCents, 0);
  const taxTotalCents = groups.reduce((s, g) => s + g.taxCents, 0);

  return {
    lines,
    groups,
    lineTotalCents,
    taxTotalCents,
    grandTotalCents: lineTotalCents + taxTotalCents,
  };
}

/* ------------------------------------------------------------------ *
 * XML fragment builders
 * ------------------------------------------------------------------ */

/** A `ram:...TradeParty` block (shared shape for seller and buyer). */
function tradePartyXml(
  tag: 'SellerTradeParty' | 'BuyerTradeParty',
  party: { name: string; street?: string; zip?: string; city?: string; countryCode: string; vatId?: string },
): string {
  const addr: string[] = ['        <ram:PostalTradeAddress>'];
  if (party.zip) addr.push(`          <ram:PostcodeCode>${esc(party.zip)}</ram:PostcodeCode>`);
  if (party.street) addr.push(`          <ram:LineOne>${esc(party.street)}</ram:LineOne>`);
  if (party.city) addr.push(`          <ram:CityName>${esc(party.city)}</ram:CityName>`);
  addr.push(`          <ram:CountryID>${esc(party.countryCode)}</ram:CountryID>`);
  addr.push('        </ram:PostalTradeAddress>');

  const lines = [
    `      <ram:${tag}>`,
    `        <ram:Name>${esc(party.name)}</ram:Name>`,
    ...addr,
  ];
  if (party.vatId) {
    lines.push(
      '        <ram:SpecifiedTaxRegistration>',
      `          <ram:ID schemeID="VA">${esc(party.vatId)}</ram:ID>`,
      '        </ram:SpecifiedTaxRegistration>',
    );
  }
  lines.push(`      </ram:${tag}>`);
  return lines.join('\n');
}

/** One `ram:IncludedSupplyChainTradeLineItem`. */
function lineItemXml(lc: LineComputed): string {
  const { line, lineNetCents } = lc;
  const category = line.taxRatePercent === 0 ? 'Z' : 'S';
  return [
    '    <ram:IncludedSupplyChainTradeLineItem>',
    '      <ram:AssociatedDocumentLineDocument>',
    `        <ram:LineID>${esc(line.id)}</ram:LineID>`,
    '      </ram:AssociatedDocumentLineDocument>',
    '      <ram:SpecifiedTradeProduct>',
    `        <ram:Name>${esc(line.name)}</ram:Name>`,
    '      </ram:SpecifiedTradeProduct>',
    '      <ram:SpecifiedLineTradeAgreement>',
    '        <ram:NetPriceProductTradePrice>',
    `          <ram:ChargeAmount>${money(line.unitPriceCents)}</ram:ChargeAmount>`,
    '        </ram:NetPriceProductTradePrice>',
    '      </ram:SpecifiedLineTradeAgreement>',
    '      <ram:SpecifiedLineTradeDelivery>',
    `        <ram:BilledQuantity unitCode="C62">${line.quantity}</ram:BilledQuantity>`,
    '      </ram:SpecifiedLineTradeDelivery>',
    '      <ram:SpecifiedLineTradeSettlement>',
    '        <ram:ApplicableTradeTax>',
    '          <ram:TypeCode>VAT</ram:TypeCode>',
    `          <ram:CategoryCode>${category}</ram:CategoryCode>`,
    `          <ram:RateApplicablePercent>${percent(line.taxRatePercent)}</ram:RateApplicablePercent>`,
    '        </ram:ApplicableTradeTax>',
    '        <ram:SpecifiedTradeSettlementLineMonetarySummation>',
    `          <ram:LineTotalAmount>${money(lineNetCents)}</ram:LineTotalAmount>`,
    '        </ram:SpecifiedTradeSettlementLineMonetarySummation>',
    '      </ram:SpecifiedLineTradeSettlement>',
    '    </ram:IncludedSupplyChainTradeLineItem>',
  ].join('\n');
}

/** Header-level `ram:ApplicableTradeTax` for one rate group. */
function headerTaxXml(g: TaxGroup): string {
  return [
    '      <ram:ApplicableTradeTax>',
    `        <ram:CalculatedAmount>${money(g.taxCents)}</ram:CalculatedAmount>`,
    '        <ram:TypeCode>VAT</ram:TypeCode>',
    `        <ram:BasisAmount>${money(g.basisCents)}</ram:BasisAmount>`,
    `        <ram:CategoryCode>${g.categoryCode}</ram:CategoryCode>`,
    `        <ram:RateApplicablePercent>${percent(g.ratePercent)}</ram:RateApplicablePercent>`,
    '      </ram:ApplicableTradeTax>',
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Build a complete EN 16931-compliant CrossIndustryInvoice XML document.
 *
 * The function is total: missing optional fields (street/zip/city/vatId, iban,
 * dueDate, note) simply omit their elements. EN 16931 *mandatory* fields that
 * have no fallback — seller/buyer name, country code, and an invoice line —
 * must be supplied by the caller (see module export notes).
 */
export function buildCiiXml(data: EInvoiceData): string {
  const totals = computeTotals(data);
  const currency = esc(data.currency);

  /* --- ExchangedDocument (header) --- */
  const documentLines: string[] = [
    '  <rsm:ExchangedDocument>',
    `    <ram:ID>${esc(data.invoiceNumber)}</ram:ID>`,
    '    <ram:TypeCode>380</ram:TypeCode>',
    '    <ram:IssueDateTime>',
    `      <udt:DateTimeString format="102">${dateYmd(data.issueDate)}</udt:DateTimeString>`,
    '    </ram:IssueDateTime>',
  ];
  if (data.note && data.note.trim()) {
    documentLines.push(
      '    <ram:IncludedNote>',
      `      <ram:Content>${esc(data.note)}</ram:Content>`,
      '    </ram:IncludedNote>',
    );
  }
  documentLines.push('  </rsm:ExchangedDocument>');

  /* --- Lines --- */
  const lineItems = totals.lines.map(lineItemXml);

  /* --- ApplicableHeaderTradeAgreement --- */
  const agreement = [
    '    <ram:ApplicableHeaderTradeAgreement>',
    tradePartyXml('SellerTradeParty', data.seller),
    tradePartyXml('BuyerTradeParty', data.buyer),
    '    </ram:ApplicableHeaderTradeAgreement>',
  ].join('\n');

  /* --- ApplicableHeaderTradeSettlement --- */
  const settlement: string[] = [
    '    <ram:ApplicableHeaderTradeSettlement>',
    `      <ram:InvoiceCurrencyCode>${currency}</ram:InvoiceCurrencyCode>`,
  ];

  // SEPA credit transfer (TypeCode 58) — only when an IBAN is known.
  if (data.seller.iban) {
    settlement.push(
      '      <ram:SpecifiedTradeSettlementPaymentMeans>',
      '        <ram:TypeCode>58</ram:TypeCode>',
      '        <ram:PayeePartyCreditorFinancialAccount>',
      `          <ram:IBANID>${esc(data.seller.iban)}</ram:IBANID>`,
      '        </ram:PayeePartyCreditorFinancialAccount>',
    );
    if (data.seller.bic) {
      settlement.push(
        '        <ram:PayeeSpecifiedCreditorFinancialInstitution>',
        `          <ram:BICID>${esc(data.seller.bic)}</ram:BICID>`,
        '        </ram:PayeeSpecifiedCreditorFinancialInstitution>',
      );
    }
    settlement.push('      </ram:SpecifiedTradeSettlementPaymentMeans>');
  }

  // One ApplicableTradeTax per distinct VAT rate.
  for (const g of totals.groups) settlement.push(headerTaxXml(g));

  // Payment terms with due date (BT-9).
  if (data.dueDate) {
    settlement.push(
      '      <ram:SpecifiedTradePaymentTerms>',
      '        <ram:DueDateDateTime>',
      `          <udt:DateTimeString format="102">${dateYmd(data.dueDate)}</udt:DateTimeString>`,
      '        </ram:DueDateDateTime>',
      '      </ram:SpecifiedTradePaymentTerms>',
    );
  }

  // Document totals (BG-22). Zero charge/allowance/prepaid are emitted so the
  // BR-CO total equations balance for any validator.
  settlement.push(
    '      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    `        <ram:LineTotalAmount>${money(totals.lineTotalCents)}</ram:LineTotalAmount>`,
    '        <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>',
    '        <ram:AllowanceTotalAmount>0.00</ram:AllowanceTotalAmount>',
    `        <ram:TaxBasisTotalAmount>${money(totals.lineTotalCents)}</ram:TaxBasisTotalAmount>`,
    `        <ram:TaxTotalAmount currencyID="${currency}">${money(totals.taxTotalCents)}</ram:TaxTotalAmount>`,
    `        <ram:GrandTotalAmount>${money(totals.grandTotalCents)}</ram:GrandTotalAmount>`,
    '        <ram:TotalPrepaidAmount>0.00</ram:TotalPrepaidAmount>',
    `        <ram:DuePayableAmount>${money(totals.grandTotalCents)}</ram:DuePayableAmount>`,
    '      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    '    </ram:ApplicableHeaderTradeSettlement>',
  );

  /* --- Assemble document --- */
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<rsm:CrossIndustryInvoice xmlns:rsm="${NS.rsm}" xmlns:ram="${NS.ram}" xmlns:qdt="${NS.qdt}" xmlns:udt="${NS.udt}">`,
    '  <rsm:ExchangedDocumentContext>',
    '    <ram:GuidelineSpecifiedDocumentContextParameter>',
    // EN 16931 core profile. XRechnung CIUS URN noted in PROFILE_EN16931 docblock.
    `      <ram:ID>${PROFILE_EN16931}</ram:ID>`,
    '    </ram:GuidelineSpecifiedDocumentContextParameter>',
    '  </rsm:ExchangedDocumentContext>',
    documentLines.join('\n'),
    '  <rsm:SupplyChainTradeTransaction>',
    lineItems.join('\n'),
    agreement,
    '    <ram:ApplicableHeaderTradeDelivery/>',
    settlement.join('\n'),
    '  </rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
    '',
  ].join('\n');
}

/**
 * Safe download filename for a CII XML, e.g. "Rechnung-2024-0001.xml".
 * Strips anything that isn't a letter, digit, dot, dash or underscore.
 */
export function eInvoiceFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `Rechnung-${safe || 'rechnung'}.xml`;
}
