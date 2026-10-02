/**
 * Pure invoice helpers shared by the detail queries (server) and the on-screen
 * invoice document (client). No pdf-lib, no DB — safe to import anywhere.
 * Mirrors the totals algorithm used by the PDF builder so screen + PDF agree.
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface InvoiceDocItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRate: number; // percent
}

export interface InvoiceTotals {
  netCents: number;
  taxCents: number;
  grossCents: number;
  taxByRate: { rate: number; netCents: number; taxCents: number }[];
}

export function computeTotals(items: InvoiceDocItem[]): InvoiceTotals {
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

/** German money: 1.234,56 (no Intl, deterministic). */
export function fmtCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const eurStr = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '-' : ''}${eurStr},${rest.toString().padStart(2, '0')}`;
}

/** "1.234,56 €" — the € glyph is fine on screen (unlike the WinAnsi PDF). */
export function fmtEuro(cents: number): string {
  return `${fmtCents(cents)} €`;
}

/** "DE89 3704 0044 0532 0130 00" — IBAN in readable groups of four. */
export function fmtIban(iban: string): string {
  return iban.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim().toUpperCase();
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—';
  const dd = d.getDate().toString().padStart(2, '0');
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

/** Local HH:mm (browser tz — for the user this is Europe/Berlin). */
export function fmtTime(d: Date | null | undefined): string {
  if (!d) return '—';
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Local "dd.mm.yyyy, HH:mm". */
export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  return `${fmtDate(d)}, ${fmtTime(d)}`;
}

/**
 * "dd.mm.yyyy, HH:mm" explicitly in Europe/Berlin — for server-side use
 * (emails) where the runtime is UTC. Falls back to local formatting.
 */
export function fmtBerlinDateTime(d: Date | null | undefined): string {
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(d);
  } catch {
    return fmtDateTime(d);
  }
}

export interface StatusMeta {
  label: string;
  fg: string;
  bg: string;
  border: string;
}

export function statusMeta(status: InvoiceStatus): StatusMeta {
  switch (status) {
    case 'paid':    return { label: 'Bezahlt',     fg: '#15803D', bg: '#DCFCE7', border: '#A7F3C0' };
    case 'overdue': return { label: 'Überfällig',  fg: '#DC2626', bg: '#FEE2E2', border: '#FECACA' };
    case 'sent':    return { label: 'Offen',       fg: '#B45309', bg: '#FEF3C7', border: '#FDE38A' };
    default:        return { label: 'Entwurf',     fg: '#52525B', bg: '#F1F1EF', border: '#E4E3DF' };
  }
}

/** Whole document payload — produced by the detail queries, consumed by <InvoiceDocument>. */
export interface InvoiceDetail {
  id: string;
  invoiceNumber: string | null;
  title: string;
  status: InvoiceStatus;
  issueDate: Date | null;
  dueDate: Date | null;
  notes: string | null;
  totalAmount: number; // stored gross in cents (authoritative; items may be empty for upload invoices)
  visibleToClient: boolean;
  hasPdf: boolean;
  agency: {
    name: string;
    logo: string | null;
    accentColor: string | null;
    address: string | null;
    contactEmail: string | null;
    phone: string | null;
    website: string | null;
    taxId: string | null;
    iban: string | null;
    bic: string | null;
  };
  client: { name: string; company: string | null; email: string | null };
  clientId: string;
  projectId: string;
  projectName: string;
  items: InvoiceDocItem[];
  totals: InvoiceTotals;
}
