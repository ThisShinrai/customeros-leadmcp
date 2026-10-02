import { and, eq, isNull } from 'drizzle-orm';
import { getRequestDb } from '@/lib/db';
import { apiKeys } from '@/lib/db';

/** SHA-256 hex (Web Crypto — edge-safe, no Node APIs). */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a fresh key + its hash + a display prefix. The raw key is shown once. */
export async function generateApiKey(): Promise<{ key: string; hash: string; prefix: string }> {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const rand = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = `eps_live_${rand}`;
  return { key, hash: await hashApiKey(key), prefix: key.slice(0, 16) };
}

/** Resolve a raw `eps_live_…` key to an agency, or null. Stamps last_used_at. */
export async function authenticateApiKeyValue(rawKey: string): Promise<{ agencyId: string } | null> {
  if (!/^eps_live_[a-f0-9]+$/i.test(rawKey)) return null;
  const hash = await hashApiKey(rawKey);
  const db = await getRequestDb();
  const row = await db.query.apiKeys.findFirst({ where: and(eq(apiKeys.keyHash, hash), isNull(apiKeys.revokedAt)) });
  if (!row) return null;
  try { await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)); } catch { /* best-effort */ }
  return { agencyId: row.agencyId };
}

/** Resolve a `Authorization: Bearer eps_live_…` header to an agency, or null. */
export async function authenticateApiKey(req: Request): Promise<{ agencyId: string } | null> {
  const auth = req.headers.get('authorization') || '';
  const m = auth.match(/^Bearer\s+(eps_live_[a-f0-9]+)$/i);
  if (!m) return null;
  return authenticateApiKeyValue(m[1]);
}
