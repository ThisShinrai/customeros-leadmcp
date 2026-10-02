import { drizzle } from 'drizzle-orm/d1';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import * as schema from './schema';

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;

/**
 * Unified access to the Cloudflare environment from any server context
 * (RSC, Server Actions, Route Handlers). Works in `next dev` because of
 * initOpenNextCloudflareForDev() in next.config.ts.
 */
export async function getRequestEnv(): Promise<CloudflareEnv> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as CloudflareEnv;
}

/** Drizzle DB bound to the current request's D1 instance. */
export async function getRequestDb(): Promise<Db> {
  const env = await getRequestEnv();
  return getDb(env.DB);
}

export * from './schema';
