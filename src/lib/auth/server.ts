import { headers } from 'next/headers';
import { getRequestDb } from '@/lib/db';
import { createAuth } from './index';

/** Raw BetterAuth session (user + session), or null. */
export async function getSession() {
  const db = await getRequestDb();
  const auth = createAuth(db);
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}
