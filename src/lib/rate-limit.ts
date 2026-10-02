import { sql } from 'drizzle-orm';
import type { Db } from '@/lib/db';

export interface RateLimitOptions {
  /** Max number of requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfter: number;
}

/**
 * D1-backed fixed-window rate limiter. Edge-safe: uses only Web APIs + drizzle
 * raw SQL against the `rate_limits` table (no KV, no Node crypto, no fs).
 *
 * Logic per `key`:
 *  - No row, or the current window has elapsed (`now - window_start >= windowSec`)
 *    → start a fresh window (count = 1, window_start = now) → allowed.
 *  - Within window and `count < limit` → increment → allowed.
 *  - Within window and `count >= limit` → not allowed,
 *    `retryAfter = windowSec - (now - window_start)`.
 *
 * Fails OPEN: any DB error is swallowed and treated as `allowed`, so a limiter
 * bug can never lock real users out.
 */
export async function checkRateLimit(
  db: Db,
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const { limit, windowSec } = opts;
  // Runs at request time in the Worker runtime — Date.now() is fine here.
  const now = Math.floor(Date.now() / 1000);

  try {
    const rows = await db.all<{ count: number; window_start: number }>(
      sql`SELECT count, window_start FROM rate_limits WHERE key = ${key} LIMIT 1`,
    );
    const row = rows[0];

    // Fresh window: no row yet, or the previous window has fully elapsed.
    if (!row || now - row.window_start >= windowSec) {
      await db.run(
        sql`INSERT INTO rate_limits (key, count, window_start)
            VALUES (${key}, 1, ${now})
            ON CONFLICT(key) DO UPDATE SET count = 1, window_start = ${now}`,
      );
      return { allowed: true, retryAfter: 0 };
    }

    // Within the current window and still under the limit → count this request.
    if (row.count < limit) {
      await db.run(
        sql`UPDATE rate_limits SET count = count + 1 WHERE key = ${key}`,
      );
      return { allowed: true, retryAfter: 0 };
    }

    // Within the window and limit reached → reject.
    const retryAfter = Math.max(1, windowSec - (now - row.window_start));
    return { allowed: false, retryAfter };
  } catch (err) {
    // Never let a limiter failure block legitimate traffic.
    console.error('[rate-limit] failing open:', err);
    return { allowed: true, retryAfter: 0 };
  }
}
