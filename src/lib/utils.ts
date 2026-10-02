import { nanoid } from 'nanoid';

/** URL-safe slug from arbitrary text (handles German umlauts). */
export function slugify(input: string): string {
  const map: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  const replaced = input.toLowerCase().replace(/[äöüß]/g, (c) => map[c] ?? c);
  return (
    replaced
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'agentur'
  );
}

/** Short random suffix for slug collision resolution / tokens. */
export function shortId(len = 8): string {
  return nanoid(len);
}

/** "#0A0A0A" -> "10,10,10" for rgba() usage. */
export function hexToRgb(hex: string): string {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length < 3) return '10,10,10';
  return m.slice(0, 3).map((h) => parseInt(h, 16)).join(',');
}

export function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

/** Format cents as EUR. */
export function formatEUR(cents: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Relative German time label ("vor 3 Min.", "gestern"). */
export function relativeTime(date: Date | number | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'number' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'gestern';
  if (days < 7) return `vor ${days} Tagen`;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileTypeLabel(mime: string, name: string): string {
  const ext = name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : '';
  if (ext) return ext;
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('image')) return 'IMG';
  if (mime.includes('zip')) return 'ZIP';
  return 'FILE';
}

export function formatDate(date: Date | number | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
}
