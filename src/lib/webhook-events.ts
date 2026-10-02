/** Client-safe (no db imports) catalogue of webhook events. */
export const WEBHOOK_EVENTS = [
  { key: 'invoice.sent', label: 'Rechnung an Kunde freigegeben' },
  { key: 'invoice.paid', label: 'Rechnung als bezahlt markiert' },
  { key: 'client.created', label: 'Kunde eingeladen' },
  { key: 'proposal.signed', label: 'Angebot unterschrieben' },
] as const;

export type WebhookEventKey = typeof WEBHOOK_EVENTS[number]['key'];
export const WEBHOOK_EVENT_KEYS: string[] = WEBHOOK_EVENTS.map((e) => e.key);

/** Normalise a user-chosen event list to what we store: ['*'] (all) or a valid subset. */
export function normalizeWebhookEvents(events: string[]): string[] {
  if (!events || events.length === 0 || events.includes('*')) return ['*'];
  const valid = events.filter((e) => WEBHOOK_EVENT_KEYS.includes(e));
  return valid.length > 0 ? [...new Set(valid)] : ['*'];
}

/** Does an endpoint's stored event list match a fired event? */
export function webhookMatches(stored: string | null | undefined, event: string): boolean {
  let evs: string[];
  try { evs = JSON.parse(stored ?? '["*"]'); } catch { evs = ['*']; }
  return Array.isArray(evs) && (evs.includes('*') || evs.includes(event));
}
