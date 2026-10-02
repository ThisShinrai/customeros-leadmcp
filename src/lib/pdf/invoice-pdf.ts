import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

/**
 * Edge-safe invoice PDF generation via pdf-lib (pure JS, no Node APIs).
 * Layout: DIN-5008-angelehnter Briefkopf, ruhige Typografie mit viel
 * Weißraum, Positions-Tabelle mit Haarlinien statt Balken, Buchhalter-
 * Doppelstrich unter der Summe, Zahlungs-Panel mit IBAN/BIC und
 * Seitenumbruch mit Fußzeile + Seitennummerierung auf jeder Seite.
 */

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRate: number; // percent, e.g. 19
}

export interface InvoicePdfData {
  invoiceNumber: string;
  title: string;
  issueDate: Date;
  dueDate: Date | null;
  agency: {
    name: string;
    address?: string | null;
    street?: string | null;
    zip?: string | null;
    city?: string | null;
    country?: string | null;
    contactEmail?: string | null;
    phone?: string | null;
    website?: string | null;
    taxId?: string | null;
    iban?: string | null;
    bic?: string | null;
  };
  client: {
    name: string;
    company?: string | null;
    email?: string | null;
  };
  items: InvoicePdfItem[];
  notes?: string | null;
  accentHex?: string | null;
}

export interface InvoiceTotals {
  netCents: number;
  taxCents: number;
  grossCents: number;
  taxByRate: { rate: number; netCents: number; taxCents: number }[];
}

export function computeInvoiceTotals(items: InvoicePdfItem[]): InvoiceTotals {
  let netCents = 0;
  let taxCents = 0;
  const byRate = new Map<number, { netCents: number; taxCents: number }>();
  for (const it of items) {
    const lineNet = Math.round(it.quantity * it.unitPriceCents);
    const lineTax = Math.round((lineNet * it.taxRate) / 100);
    netCents += lineNet;
    taxCents += lineTax;
    const cur = byRate.get(it.taxRate) ?? { netCents: 0, taxCents: 0 };
    cur.netCents += lineNet;
    cur.taxCents += lineTax;
    byRate.set(it.taxRate, cur);
  }
  const taxByRate = [...byRate.entries()]
    .filter(([rate]) => rate > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([rate, v]) => ({ rate, netCents: v.netCents, taxCents: v.taxCents }));
  return { netCents, taxCents, grossCents: netCents + taxCents, taxByRate };
}

// German money formatting: 1.234,56 — without using Intl (kept deterministic & light).
function fmtCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const eurStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${eurStr},${rest.toString().padStart(2, '0')}`;
}
function eur(cents: number): string {
  return `${fmtCents(cents)} €`;
}

function fmtDate(d: Date): string {
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function fmtIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim().toUpperCase();
}

function hexToRgb01(hex?: string | null): RGB {
  const fallback = rgb(0.04, 0.04, 0.04);
  if (!hex) return fallback;
  const m = hex.replace('#', '');
  if (m.length !== 6) return fallback;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return fallback;
  return rgb(r / 255, g / 255, b / 255);
}

/** WinAnsi (Helvetica) can't encode every char; strip anything unsupported. */
function safe(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\xFF€]/g, '');
}

export async function buildInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Rechnung ${data.invoiceNumber}`);
  doc.setProducer('epssys');
  doc.setCreator('epssys');

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.04, 0.04, 0.04);
  const mid = rgb(0.32, 0.32, 0.32);
  const faint = rgb(0.55, 0.55, 0.55);
  const hairline = rgb(0.87, 0.87, 0.85);
  const wash = rgb(0.965, 0.961, 0.949);
  const rawAccent = hexToRgb01(data.accentHex);
  // Accent bar/border can be any color; accent *text* falls back to ink when
  // the color is too light to read on white.
  const accentLum = 0.299 * rawAccent.red + 0.587 * rawAccent.green + 0.114 * rawAccent.blue;
  const accentText = accentLum > 0.68 ? ink : rawAccent;

  const A4: [number, number] = [595.28, 841.89];
  const W = A4[0];
  const H = A4[1];
  const M = 56;
  const right = W - M;
  const FOOTER_TOP = 92; // content must stay above this line

  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: RGB; page?: PDFPage } = {},
  ) => {
    (opts.page ?? page).drawText(safe(s), { x, y: yy, size: opts.size ?? 9.5, font: opts.font ?? font, color: opts.color ?? ink });
  };
  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: RGB; page?: PDFPage } = {},
  ) => {
    const f = opts.font ?? font;
    const size = opts.size ?? 9.5;
    const w = f.widthOfTextAtSize(safe(s), size);
    text(s, xRight - w, yy, opts);
  };
  // Letter-spaced uppercase micro-labels — the typographic backbone of the layout.
  const trackedWidth = (s: string, size: number, tracking: number, f: PDFFont = bold): number => {
    const t = safe(s);
    let w = 0;
    for (const ch of t) w += f.widthOfTextAtSize(ch, size) + tracking;
    return t.length ? w - tracking : 0;
  };
  const tracked = (
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; color?: RGB; tracking?: number; font?: PDFFont } = {},
  ) => {
    const size = opts.size ?? 7;
    const tr = opts.tracking ?? 1.4;
    const f = opts.font ?? bold;
    let cx = x;
    for (const ch of safe(s.toUpperCase())) {
      page.drawText(ch, { x: cx, y: yy, size, font: f, color: opts.color ?? faint });
      cx += f.widthOfTextAtSize(ch, size) + tr;
    }
  };
  const trackedRight = (s: string, xRight: number, yy: number, opts: Parameters<typeof tracked>[3] = {}) => {
    tracked(s, xRight - trackedWidth(s.toUpperCase(), opts.size ?? 7, opts.tracking ?? 1.4, opts.font ?? bold), yy, opts);
  };
  const rule = (yy: number, opts: { thickness?: number; color?: RGB; x1?: number; x2?: number } = {}) => {
    page.drawLine({
      start: { x: opts.x1 ?? M, y: yy },
      end: { x: opts.x2 ?? right, y: yy },
      thickness: opts.thickness ?? 0.5,
      color: opts.color ?? hairline,
    });
  };

  const wrap = (s: string, maxWidth: number, size: number, f: PDFFont = font): string[] => {
    const words = safe(s).split(/\s+/);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  };

  // Table column anchors (right-aligned number columns).
  const posX = M;
  const descX = M + 24;
  const qtyR = right - 218;
  const unitR = right - 128;
  const taxR = right - 72;
  const amtR = right;
  const descMax = qtyR - 44 - descX;

  const drawTableHead = () => {
    tracked('Pos.', posX, y, { size: 6.8 });
    tracked('Beschreibung', descX, y, { size: 6.8 });
    trackedRight('Menge', qtyR, y, { size: 6.8 });
    trackedRight('Einzelpreis', unitR, y, { size: 6.8 });
    trackedRight('MwSt.', taxR, y, { size: 6.8 });
    trackedRight('Betrag', amtR, y, { size: 6.8 });
    y -= 8;
    rule(y, { thickness: 1.1, color: ink });
    y -= 16;
  };

  const addPage = (opts: { continuation?: boolean } = {}) => {
    page = doc.addPage(A4);
    pages.push(page);
    y = H - M;
    // Slim accent signature along the top of every page.
    page.drawRectangle({ x: 0, y: H - 3, width: W, height: 3, color: rawAccent });
    if (opts.continuation) {
      text(data.agency.name, M, y - 4, { font: bold, size: 10.5 });
      textRight(`Rechnung ${data.invoiceNumber}`, right, y - 4, { size: 8.5, color: faint });
      y -= 18;
      rule(y);
      y -= 24;
    }
  };

  /** Break to a fresh page when fewer than `needed` points remain. */
  const ensureSpace = (needed: number, opts: { tableHead?: boolean } = {}) => {
    if (y - needed < FOOTER_TOP) {
      addPage({ continuation: true });
      if (opts.tableHead) drawTableHead();
    }
  };

  // ── Page 1 · Briefkopf ─────────────────────────────────────────────
  addPage();

  text(data.agency.name, M, y - 10, { font: bold, size: 19 });

  const senderCityLine = [data.agency.zip, data.agency.city].filter(Boolean).join(' ');
  const contactLines = [
    data.agency.street || data.agency.address || '',
    senderCityLine,
    data.agency.contactEmail || '',
    data.agency.phone || '',
    data.agency.website || '',
  ].filter(Boolean);
  let cy = y - 2;
  for (const l of contactLines) {
    textRight(l, right, cy, { size: 7.5, color: faint });
    cy -= 10.5;
  }

  y -= Math.max(46, 14 + contactLines.length * 10.5);
  rule(y);
  y -= 34;

  // ── Rechnungskopf: Nummer groß, Meta rechts ────────────────────────
  tracked('Rechnung', M, y, { size: 8, color: accentText, tracking: 2.2 });
  y -= 20;
  text(data.invoiceNumber, M, y, { font: bold, size: 22 });

  const meta: [string, string][] = [['Rechnungsdatum', fmtDate(data.issueDate)]];
  if (data.dueDate) meta.push(['Zahlbar bis', fmtDate(data.dueDate)]);
  let my = y + 20;
  for (const [k, v] of meta) {
    text(k, right - 185, my, { size: 8.5, color: faint });
    textRight(v, right, my, { font: bold, size: 9 });
    my -= 15;
  }

  y -= 16;
  text(data.title, M, y, { size: 10.5, color: mid });
  y -= 32;

  // ── Empfänger (DIN-Absenderzeile + Anschrift) ──────────────────────
  const senderLine = [data.agency.name, data.agency.street || data.agency.address, senderCityLine]
    .filter(Boolean)
    .join(' · ');
  if (senderLine !== data.agency.name) {
    text(senderLine, M, y, { size: 6.5, color: faint });
    y -= 4;
    rule(y, { x2: M + Math.min(font.widthOfTextAtSize(safe(senderLine), 6.5), right - M) });
    y -= 14;
  }
  tracked('Rechnung an', M, y, { size: 7 });
  y -= 16;
  text(data.client.company || data.client.name, M, y, { font: bold, size: 11 });
  y -= 14;
  if (data.client.company && data.client.name) {
    text(data.client.name, M, y, { size: 9.5, color: mid });
    y -= 13;
  }
  if (data.client.email) {
    text(data.client.email, M, y, { size: 9.5, color: mid });
    y -= 13;
  }
  y -= 20;

  // ── Positionstabelle ───────────────────────────────────────────────
  drawTableHead();

  data.items.forEach((it, idx) => {
    const descLines = wrap(it.description, descMax, 9.5);
    const rowH = descLines.length * 12.5 + 11;
    ensureSpace(rowH + 6, { tableHead: true });

    const lineNet = Math.round(it.quantity * it.unitPriceCents);
    text((idx + 1).toString().padStart(2, '0'), posX, y, { size: 9, color: faint });
    let dy = y;
    for (const dl of descLines) {
      text(dl, descX, dy, { size: 9.5 });
      dy -= 12.5;
    }
    textRight(String(it.quantity), qtyR, y, { size: 9.5, color: mid });
    textRight(eur(it.unitPriceCents), unitR, y, { size: 9.5, color: mid });
    textRight(`${it.taxRate} %`, taxR, y, { size: 9.5, color: mid });
    textRight(eur(lineNet), amtR, y, { font: bold, size: 9.5 });

    y -= rowH;
    rule(y + 4, { thickness: 0.4 });
    y -= 8;
  });

  // ── Summenblock (rechtsbündig, Buchhalter-Doppelstrich) ────────────
  const totals = computeInvoiceTotals(data.items);
  const totalsRows = 1 + Math.max(totals.taxByRate.length, 1);
  ensureSpace(totalsRows * 16 + 64);
  const totX = right - 236;

  y -= 4;
  const totalLine = (label: string, value: string) => {
    text(label, totX, y, { size: 9.5, color: mid });
    textRight(value, amtR, y, { size: 9.5 });
    y -= 16;
  };
  totalLine('Zwischensumme (netto)', eur(totals.netCents));
  if (totals.taxByRate.length === 0) {
    totalLine('Umsatzsteuer', eur(0));
  } else {
    for (const t of totals.taxByRate) totalLine(`zzgl. ${t.rate} % MwSt.`, eur(t.taxCents));
  }

  y -= 2;
  rule(y + 10, { x1: totX, thickness: 1.2, color: ink });
  y -= 8;
  text('Gesamtbetrag', totX, y, { font: bold, size: 10.5 });
  textRight(eur(totals.grossCents), amtR, y, { font: bold, size: 13, color: accentText });
  y -= 9;
  rule(y, { x1: totX, thickness: 0.7, color: ink });
  rule(y - 2.2, { x1: totX, thickness: 0.7, color: ink });
  y -= 20;

  if (totals.taxByRate.length === 0) {
    ensureSpace(16);
    text('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.', M, y, { size: 8, color: faint });
    y -= 22;
  }

  // ── Zahlungs-Panel ─────────────────────────────────────────────────
  const payLines: [string, string][] = [];
  if (data.agency.iban) payLines.push(['IBAN', fmtIban(data.agency.iban)]);
  if (data.agency.bic) payLines.push(['BIC', data.agency.bic.toUpperCase()]);
  payLines.push(['Verwendungszweck', data.invoiceNumber]);
  const payTerms = data.dueDate
    ? `Zahlbar bis ${fmtDate(data.dueDate)} ohne Abzug.`
    : 'Zahlbar nach Erhalt ohne Abzug.';

  const panelH = 30 + payLines.length * 14 + 16;
  ensureSpace(panelH + 10);
  page.drawRectangle({ x: M, y: y - panelH + 14, width: right - M, height: panelH, color: wash });
  page.drawRectangle({ x: M, y: y - panelH + 14, width: 3, height: panelH, color: rawAccent });
  const px = M + 18;
  let py = y - 6;
  tracked('Zahlung', px, py, { size: 7 });
  py -= 17;
  for (const [k, v] of payLines) {
    text(k, px, py, { size: 8.5, color: faint });
    text(v, px + 100, py, { font: bold, size: 9 });
    py -= 14;
  }
  text(payTerms, px, py, { size: 8.5, color: mid });
  y -= panelH + 14;

  // ── Anmerkungen ────────────────────────────────────────────────────
  if (data.notes && data.notes.trim()) {
    const noteLines = wrap(data.notes, right - M, 9);
    ensureSpace(24 + noteLines.length * 12);
    tracked('Anmerkungen', M, y, { size: 7 });
    y -= 15;
    for (const nl of noteLines) {
      text(nl, M, y, { size: 9, color: mid });
      y -= 12;
    }
  }

  // ── Fußzeile auf jeder Seite (nach Abschluss: Seitenzahlen bekannt) ─
  const addrOneLine = [data.agency.street || data.agency.address, senderCityLine].filter(Boolean).join(', ');
  const foot1 = [data.agency.name, addrOneLine].filter(Boolean).join(' · ');
  const foot2 = [data.agency.contactEmail, data.agency.phone, data.agency.website].filter(Boolean).join(' · ');
  const foot3 = [
    data.agency.taxId ? `USt-IdNr. ${data.agency.taxId}` : '',
    data.agency.iban ? `IBAN ${fmtIban(data.agency.iban)}` : '',
    data.agency.bic ? `BIC ${data.agency.bic.toUpperCase()}` : '',
  ].filter(Boolean).join(' · ');

  pages.forEach((pg, i) => {
    const fy = 44;
    pg.drawLine({ start: { x: M, y: fy + 26 }, end: { x: right, y: fy + 26 }, thickness: 0.5, color: hairline });
    text(foot1, M, fy + 14, { size: 7, color: faint, page: pg });
    if (foot2) text(foot2, M, fy + 4, { size: 7, color: faint, page: pg });
    if (foot3) text(foot3, M, fy - 6, { size: 7, color: faint, page: pg });
    textRight(`Seite ${i + 1} von ${pages.length}`, right, fy + 14, { size: 7, color: faint, page: pg });
    textRight('Erstellt mit epssys', right, fy + 4, { size: 7, color: faint, page: pg });
    text('Vielen Dank für Ihr Vertrauen.', M, fy - 18, { size: 7.5, color: mid, page: pg });
  });

  return await doc.save();
}
